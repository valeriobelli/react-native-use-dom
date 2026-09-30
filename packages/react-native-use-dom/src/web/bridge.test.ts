import { DomErrorCode } from '../runtime/errors';
import type { DomToNativeMessage, NativeToDomMessage } from '../runtime/protocol';
import { encodeMessage, nativeEventName, POST_MESSAGE_GLOBAL } from '../runtime/protocol';
import { serializeError } from '../runtime/wire-error';
import { createDomBridge, readInjectedPayload } from './bridge';
import type { DomBridge, InjectedPayload } from './bridge';

const PAYLOAD: InjectedPayload = {
	instanceId: 'i1',
	props: { title: 'Hello' },
	actions: ['onSave'],
};

let sent: DomToNativeMessage[];

function installWebViewGlobal(payload: InjectedPayload | null = PAYLOAD): void {
	sent = [];
	(globalThis as Record<string, unknown>)[POST_MESSAGE_GLOBAL] = {
		postMessage: (raw: string) => sent.push(JSON.parse(raw) as DomToNativeMessage),
		injectedObjectJson: () => (payload === null ? undefined : JSON.stringify(payload)),
	};
}

/** Lets every pending microtask and promise job settle before asserting. */
function flush(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

/** Delivers a message the way the native side does: a CustomEvent scoped to the instance. */
function deliver(message: NativeToDomMessage, instanceId = message.instanceId): void {
	globalThis.dispatchEvent(new CustomEvent(nativeEventName(instanceId), { detail: encodeMessage(message) }));
}

/** Asks the DOM side to run a method exposed through `useDOMImperativeHandle`. */
function callHandle(method: string, args: unknown[] = []): void {
	deliver({ type: 'handle-call', instanceId: 'i1', callId: 'c1', method, args: args as never });
}

function lastOfType<T extends DomToNativeMessage['type']>(
	type: T,
): Extract<DomToNativeMessage, { type: T }> | undefined {
	const matches = sent.filter((message) => message.type === type);
	return matches.at(-1) as Extract<DomToNativeMessage, { type: T }> | undefined;
}

describe('readInjectedPayload', () => {
	it('reads the props the native side injected before the bundle ran', () => {
		installWebViewGlobal();
		expect(readInjectedPayload()).toEqual(PAYLOAD);
	});

	it('explains itself when opened outside a WebView', () => {
		delete (globalThis as Record<string, unknown>)[POST_MESSAGE_GLOBAL];
		expect(() => readInjectedPayload()).toThrow(/not running inside a React Native WebView/u);
	});

	it('reports a missing payload rather than returning nothing', () => {
		installWebViewGlobal(null);
		expect(() => readInjectedPayload()).toThrow(/without its initial props/u);
	});
});

describe('createDomBridge', () => {
	let bridge: DomBridge;

	beforeEach(() => {
		installWebViewGlobal();
		bridge = createDomBridge(PAYLOAD);
	});

	afterEach(() => {
		bridge.dispose();
	});

	it('announces itself so the native side can re-send props', () => {
		expect(sent[0]).toEqual({ type: 'ready', instanceId: 'i1', protocolVersion: 1 });
	});

	it('exposes the injected props immediately, before any message arrives', () => {
		expect(bridge.getProps()).toEqual({ title: 'Hello' });
		expect(bridge.getActionNames()).toEqual(['onSave']);
	});

	it('updates props and notifies subscribers', () => {
		const listener = jest.fn();
		bridge.subscribe(listener);

		deliver({ type: 'props', instanceId: 'i1', props: { title: 'Updated' }, actions: ['onSave'] });

		expect(bridge.getProps()).toEqual({ title: 'Updated' });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('stops notifying an unsubscribed listener', () => {
		const listener = jest.fn();
		bridge.subscribe(listener)();
		deliver({ type: 'props', instanceId: 'i1', props: {}, actions: [] });
		expect(listener).not.toHaveBeenCalled();
	});

	it('ignores traffic addressed to another instance on the same page', () => {
		const listener = jest.fn();
		bridge.subscribe(listener);

		globalThis.dispatchEvent(
			new CustomEvent(nativeEventName('i1'), {
				detail: encodeMessage({
					type: 'props',
					instanceId: 'other',
					props: { title: 'Not mine' },
					actions: [],
				}),
			}),
		);

		expect(bridge.getProps()).toEqual({ title: 'Hello' });
		expect(listener).not.toHaveBeenCalled();
	});

	describe('calling a native action', () => {
		it('posts the call and resolves with what came back', async () => {
			const pending = bridge.callAction('onSave', ['draft', 2]);

			const call = lastOfType('action-call');
			expect(call).toMatchObject({ action: 'onSave', args: ['draft', 2] });

			deliver({
				type: 'result',
				instanceId: 'i1',
				callId: call!.callId,
				ok: true,
				value: { saved: true },
			});
			await expect(pending).resolves.toEqual({ saved: true });
		});

		it('rejects with the native error, keeping its name and properties', async () => {
			const pending = bridge.callAction('onSave', []);
			const call = lastOfType('action-call');

			deliver({
				type: 'result',
				instanceId: 'i1',
				callId: call!.callId,
				ok: false,
				error: serializeError(Object.assign(new RangeError('disk full'), { free: 0 })),
			});

			await expect(pending).rejects.toMatchObject({
				name: 'RangeError',
				message: 'disk full',
				free: 0,
			});
		});

		it('rejects an unknown action without sending anything', async () => {
			await expect(bridge.callAction('nope', [])).rejects.toMatchObject({
				code: DomErrorCode.UnknownAction,
			});
			expect(lastOfType('action-call')).toBeUndefined();
		});

		it('rejects a non-serializable argument, naming its position', async () => {
			await expect(bridge.callAction('onSave', ['ok', new Date(0)])).rejects.toMatchObject({
				code: DomErrorCode.NonSerializableArgument,
				message: expect.stringContaining('argument 2 of `onSave`'),
			});
			expect(lastOfType('action-call')).toBeUndefined();
		});

		it('keeps concurrent calls apart when results come back out of order', async () => {
			const first = bridge.callAction('onSave', ['a']);
			const second = bridge.callAction('onSave', ['b']);
			const calls = sent.filter((message) => message.type === 'action-call');

			deliver({ type: 'result', instanceId: 'i1', callId: calls[1]!.callId, ok: true, value: 'B' });
			deliver({ type: 'result', instanceId: 'i1', callId: calls[0]!.callId, ok: true, value: 'A' });

			await expect(Promise.all([first, second])).resolves.toEqual(['A', 'B']);
		});

		it('rejects in-flight calls when the component goes away', async () => {
			const pending = bridge.callAction('onSave', []);
			bridge.dispose();
			await expect(pending).rejects.toMatchObject({ code: DomErrorCode.BridgeClosed });
		});
	});

	describe('being called from native through a ref', () => {
		it('runs the method and returns its value', async () => {
			bridge.setHandle({ getTitle: () => 'Hello' });
			callHandle('getTitle');
			await flush();

			expect(lastOfType('result')).toMatchObject({ callId: 'c1', ok: true, value: 'Hello' });
		});

		it('awaits an async method', async () => {
			bridge.setHandle({
				load: async () => {
					await flush();
					return { items: 3 };
				},
			});
			callHandle('load');
			await flush();

			expect(lastOfType('result')).toMatchObject({ ok: true, value: { items: 3 } });
		});

		it('reports a method that returns nothing as null', async () => {
			bridge.setHandle({ scrollToTop: () => undefined });
			callHandle('scrollToTop');
			await flush();

			expect(lastOfType('result')).toMatchObject({ ok: true, value: null });
		});

		it('reports a throwing method as a rejection carrying the DOM-side error', async () => {
			bridge.setHandle({
				explode: () => {
					throw new TypeError('nope');
				},
			});
			callHandle('explode');
			await flush();

			const result = lastOfType('result');
			expect(result).toMatchObject({ ok: false });
			expect(result).toMatchObject({ error: { name: 'TypeError', message: 'nope' } });
		});

		it('rejects a method that returns something unserializable', async () => {
			bridge.setHandle({ getNode: () => new Map() });
			callHandle('getNode');
			await flush();

			expect(lastOfType('result')).toMatchObject({
				ok: false,
				error: { message: expect.stringContaining('the value returned by `getNode`') },
			});
		});

		it('rejects a method that was never exposed, naming it', async () => {
			bridge.setHandle({ known: () => 1 });
			callHandle('unknown');
			await flush();

			expect(lastOfType('result')).toMatchObject({
				ok: false,
				error: { message: expect.stringContaining('`unknown`') },
			});
		});
	});

	describe('reporting back to the app', () => {
		it('sends measured size', () => {
			bridge.reportSize(320, 180);
			expect(lastOfType('resize')).toMatchObject({ width: 320, height: 180 });
		});

		it('forwards console output', () => {
			bridge.reportConsole('warn', ['slow render', 42]);
			expect(lastOfType('console')).toMatchObject({ level: 'warn', args: ['slow render', 42] });
		});

		it('describes a console argument that cannot be serialized instead of throwing', () => {
			const circular: Record<string, unknown> = {};
			circular['self'] = circular;
			expect(() => bridge.reportConsole('log', [circular])).not.toThrow();
			expect(lastOfType('console')?.args).toEqual(['[object Object]']);
		});

		it('forwards an uncaught error', () => {
			bridge.reportUncaughtError(new Error('render failed'));
			expect(lastOfType('uncaught-error')).toMatchObject({
				error: { name: 'Error', message: 'render failed' },
			});
		});
	});

	it('stops listening once disposed', () => {
		const listener = jest.fn();
		bridge.subscribe(listener);
		bridge.dispose();
		deliver({ type: 'props', instanceId: 'i1', props: { title: 'Late' }, actions: [] });
		expect(bridge.getProps()).toEqual({ title: 'Hello' });
	});
});
