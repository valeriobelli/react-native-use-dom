import { act, useState } from 'react';

import type { DomToNativeMessage, NativeToDomMessage } from '../runtime/protocol';
import { encodeMessage, nativeEventName, POST_MESSAGE_GLOBAL } from '../runtime/protocol';
import type { InjectedPayload } from './bridge';
import { mountDomComponent } from './mount';
import { useDOMImperativeHandle } from './use-dom-imperative-handle';

let sent: DomToNativeMessage[];

function install(payload: InjectedPayload): void {
	sent = [];
	document.body.innerHTML = '<div id="root"></div>';
	(globalThis as Record<string, unknown>)[POST_MESSAGE_GLOBAL] = {
		postMessage: (raw: string) => sent.push(JSON.parse(raw) as DomToNativeMessage),
		injectedObjectJson: () => JSON.stringify(payload),
	};
}

function deliver(message: NativeToDomMessage): void {
	globalThis.dispatchEvent(new CustomEvent(nativeEventName(message.instanceId), { detail: encodeMessage(message) }));
}

function lastOfType<T extends DomToNativeMessage['type']>(
	type: T,
): Extract<DomToNativeMessage, { type: T }> | undefined {
	const matches = sent.filter((message) => message.type === type);
	return matches.at(-1) as Extract<DomToNativeMessage, { type: T }> | undefined;
}

function flush(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

function root(): HTMLElement {
	const element = document.querySelector<HTMLElement>('#root');
	if (!element) throw new Error('missing root');
	return element;
}

function Greeting({ title }: { title: string }) {
	return <h1>{title}</h1>;
}

function GreetingWithInput({ title }: { title: string }) {
	const [typed, setTyped] = useState('');
	return (
		<>
			<h1>{title}</h1>
			<input value={typed} onChange={(event) => setTyped(event.target.value)} />
			<span data-testid="typed">{typed}</span>
		</>
	);
}

/** Records what the native action resolved with, so a test can assert on it after the click. */
let saved: unknown;

function Editor({ onSave }: { onSave: (draft: string) => Promise<unknown> }) {
	const save = () => {
		void onSave('draft').then((value) => {
			saved = value;
		});
	};
	return (
		<button type="button" onClick={save}>
			save
		</button>
	);
}

function Counter({ seed }: { seed: number }) {
	useDOMImperativeHandle(() => ({ getDouble: () => seed * 2 }), [seed]);
	return <span>{seed}</span>;
}

function Noisy() {
	console.warn('rendering', 1);
	return null;
}

beforeEach(() => {
	(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true;
});

describe('mountDomComponent', () => {
	it('renders with the injected props on first paint, without waiting for a message', async () => {
		install({ instanceId: 'i1', props: { title: 'Hello' }, actions: [] });

		await act(async () => {
			mountDomComponent(Greeting as never, { strict: false });
		});

		expect(root().textContent).toBe('Hello');
	});

	it('re-renders on a prop change while keeping DOM state alive', async () => {
		install({ instanceId: 'i1', props: { title: 'First' }, actions: [] });

		await act(async () => {
			mountDomComponent(GreetingWithInput as never, { strict: false });
		});

		const input = root().querySelector('input');
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'draft');
			input!.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(root().querySelector('[data-testid="typed"]')?.textContent).toBe('draft');

		await act(async () => {
			deliver({ type: 'props', instanceId: 'i1', props: { title: 'Second' }, actions: [] });
		});

		expect(root().querySelector('h1')?.textContent).toBe('Second');
		// The same element, still holding what was typed: the tree was updated, not remounted.
		expect(root().querySelector('input')).toBe(input);
		expect(root().querySelector('[data-testid="typed"]')?.textContent).toBe('draft');
	});

	it('turns a function prop into a stub that calls native and resolves with its result', async () => {
		install({ instanceId: 'i1', props: {}, actions: ['onSave'] });

		await act(async () => {
			mountDomComponent(Editor as never, { strict: false });
		});
		await act(async () => {
			root().querySelector('button')?.click();
		});

		const call = lastOfType('action-call');
		expect(call).toMatchObject({ action: 'onSave', args: ['draft'] });

		await act(async () => {
			deliver({ type: 'result', instanceId: 'i1', callId: call!.callId, ok: true, value: 'saved' });
			await flush();
		});
		expect(saved).toBe('saved');
	});

	it('exposes methods to native through useDOMImperativeHandle', async () => {
		install({ instanceId: 'i1', props: { seed: 2 }, actions: [] });

		await act(async () => {
			mountDomComponent(Counter as never, { strict: false });
		});
		await act(async () => {
			deliver({ type: 'handle-call', instanceId: 'i1', callId: 'c1', method: 'getDouble', args: [] });
			await flush();
		});

		expect(lastOfType('result')).toMatchObject({ callId: 'c1', ok: true, value: 4 });
	});

	it('re-reads the handle after a prop change, so a method never closes over a stale render', async () => {
		install({ instanceId: 'i1', props: { seed: 2 }, actions: [] });

		await act(async () => {
			mountDomComponent(Counter as never, { strict: false });
		});
		await act(async () => {
			deliver({ type: 'props', instanceId: 'i1', props: { seed: 5 }, actions: [] });
		});
		await act(async () => {
			deliver({ type: 'handle-call', instanceId: 'i1', callId: 'c2', method: 'getDouble', args: [] });
			await flush();
		});

		expect(lastOfType('result')).toMatchObject({ callId: 'c2', ok: true, value: 10 });
	});

	it('forwards console output from inside the component', async () => {
		install({ instanceId: 'i1', props: {}, actions: [] });

		const original = console.warn;
		await act(async () => {
			mountDomComponent(Noisy as never, { strict: false });
		});
		console.warn = original;

		expect(lastOfType('console')).toMatchObject({ level: 'warn', args: ['rendering', 1] });
	});
});
