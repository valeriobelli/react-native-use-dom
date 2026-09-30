import { DomError, DomErrorCode } from '../runtime/errors';
import { PendingCalls } from '../runtime/pending-calls';
import {
	decodeMessage,
	encodeMessage,
	nativeEventName,
	POST_MESSAGE_GLOBAL,
	PROTOCOL_VERSION,
} from '../runtime/protocol';
import type { DomToNativeMessage, NativeToDomMessage, PropsMessage, ResultMessage } from '../runtime/protocol';
import { assertSerializable } from '../runtime/serializable';
import type { Serializable } from '../runtime/serializable';
import { serializeError } from '../runtime/wire-error';

/** What the native side injects into the page before the bundle runs. */
export interface InjectedPayload {
	instanceId: string;
	props: Record<string, Serializable>;
	actions: readonly string[];
}

interface ReactNativeWebViewGlobal {
	postMessage(message: string): void;
	injectedObjectJson?: () => string | undefined;
}

/** A method exposed to the native side through `useDOMImperativeHandle`. */
export type HandleMethod = (...args: never[]) => unknown;

export interface DomBridge {
	readonly instanceId: string;
	/** Current props, updated in place before subscribers are notified. */
	getProps(): Record<string, Serializable>;
	/** Names of the props that are native actions. */
	getActionNames(): readonly string[];
	/** Subscribes to prop updates. Returns an unsubscribe function. */
	subscribe(listener: () => void): () => void;
	/** Calls a native action and resolves with whatever it returned. */
	callAction(name: string, args: readonly unknown[]): Promise<Serializable>;
	/** Replaces the methods the native side may call through the component's ref. */
	setHandle(methods: Record<string, HandleMethod> | null): void;
	/** Reports the content's measured size, for `matchContents`. */
	reportSize(width: number, height: number): void;
	/** Forwards a console call so it lands in the app's terminal. */
	reportConsole(level: 'log' | 'info' | 'warn' | 'error' | 'debug', args: readonly unknown[]): void;
	/** Reports an error that escaped the DOM component. */
	reportUncaughtError(error: unknown): void;
	/** Stops listening. Used when the page is torn down. */
	dispose(): void;
}

function readWebViewGlobal(): ReactNativeWebViewGlobal {
	const value = (globalThis as Record<string, unknown>)[POST_MESSAGE_GLOBAL];
	if (typeof value === 'object' && value !== null && 'postMessage' in value) {
		return value as ReactNativeWebViewGlobal;
	}
	throw new DomError(DomErrorCode.BridgeClosed, 'This DOM component is not running inside a React Native WebView.', {
		fix: `A '"use dom"' module can only be mounted by this library. Opening the bundle directly in a browser leaves \`window.${POST_MESSAGE_GLOBAL}\` undefined.`,
	});
}

/**
 * Reads the props the native side injected before the bundle ran.
 *
 * Reading them synchronously is what lets the first paint already show real data (E3-AC1); the
 * native side also re-sends them once the bridge reports ready, which closes the race where the
 * page loaded before the props were set.
 */
export function readInjectedPayload(): InjectedPayload {
	const raw = readWebViewGlobal().injectedObjectJson?.();
	if (raw === undefined || raw === '') {
		throw new DomError(DomErrorCode.MalformedMessage, 'The DOM component was mounted without its initial props.', {
			fix: 'This is an internal inconsistency; please report it with the app and library versions.',
		});
	}
	return JSON.parse(raw) as InjectedPayload;
}

/**
 * Creates the DOM side of the bridge for one component instance.
 *
 * Every message is scoped by `instanceId`, so several DOM components on one screen never observe
 * each other's traffic.
 */
export function createDomBridge(payload: InjectedPayload): DomBridge {
	return new WebDomBridge(payload);
}

class WebDomBridge implements DomBridge {
	readonly instanceId: string;

	readonly #webView = readWebViewGlobal();
	readonly #calls = new PendingCalls();
	readonly #listeners = new Set<() => void>();
	readonly #eventName: string;
	readonly #onNativeEvent: (event: Event) => void;

	#props: Record<string, Serializable>;
	#actionNames: readonly string[];
	#handle: Record<string, HandleMethod> | null = null;

	constructor(payload: InjectedPayload) {
		this.instanceId = payload.instanceId;
		this.#props = payload.props;
		this.#actionNames = payload.actions;

		this.#eventName = nativeEventName(payload.instanceId);
		this.#onNativeEvent = (event) => {
			this.#receive((event as CustomEvent<string>).detail);
		};
		globalThis.addEventListener(this.#eventName, this.#onNativeEvent);

		this.#post({
			type: 'ready',
			instanceId: this.instanceId,
			protocolVersion: PROTOCOL_VERSION,
		});
	}

	// Bound, because these three are read as standalone functions: `useSyncExternalStore` takes
	// `subscribe` and `getProps` detached from the object.
	readonly getProps = (): Record<string, Serializable> => this.#props;

	readonly getActionNames = (): readonly string[] => this.#actionNames;

	readonly subscribe = (listener: () => void): (() => void) => {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	};

	async callAction(name: string, args: readonly unknown[]): Promise<Serializable> {
		if (!this.#actionNames.includes(name)) {
			throw new DomError(DomErrorCode.UnknownAction, `\`${name}\` is not a native action on this DOM component.`, {
				fix: 'Native actions are the function props the component was rendered with. Check the name, and that the prop is still being passed.',
			});
		}

		args.forEach((arg, index) => {
			assertSerializable(arg, `argument ${index + 1} of \`${name}\``, DomErrorCode.NonSerializableArgument);
		});

		const { callId, result } = this.#calls.create();
		this.#post({
			type: 'action-call',
			instanceId: this.instanceId,
			callId,
			action: name,
			args: args as Serializable[],
		});
		return await result;
	}

	setHandle(methods: Record<string, HandleMethod> | null): void {
		this.#handle = methods;
	}

	reportSize(width: number, height: number): void {
		this.#post({ type: 'resize', instanceId: this.instanceId, width, height });
	}

	reportConsole(level: 'log' | 'info' | 'warn' | 'error' | 'debug', args: readonly unknown[]): void {
		// Forwarding a log must never itself throw, so an unprintable argument is described instead.
		const safe = args.map((arg) => (isJsonSafe(arg) ? arg : describeForLog(arg)));
		this.#post({
			type: 'console',
			instanceId: this.instanceId,
			level,
			args: safe as Serializable[],
		});
	}

	reportUncaughtError(error: unknown): void {
		this.#post({ type: 'uncaught-error', instanceId: this.instanceId, error: serializeError(error) });
	}

	dispose(): void {
		globalThis.removeEventListener(this.#eventName, this.#onNativeEvent);
		this.#listeners.clear();
		this.#calls.abortAll('the DOM component was torn down');
	}

	#post(message: DomToNativeMessage): void {
		// This is the WebView's own message channel, not `window.postMessage`: it takes a single
		// string and has no target origin.
		// oxlint-disable-next-line unicorn/require-post-message-target-origin
		this.#webView.postMessage(encodeMessage(message));
	}

	#receive(raw: string): void {
		const message = decodeMessage<NativeToDomMessage>(raw);
		if (message.instanceId !== this.instanceId) return;

		switch (message.type) {
			case 'props':
				this.#applyProps(message);
				break;
			case 'result':
				this.#calls.settle(message as ResultMessage);
				break;
			case 'handle-call':
				this.#runHandleMethod(message.callId, message.method, message.args);
				break;
			default:
				break;
		}
	}

	#applyProps(message: PropsMessage): void {
		this.#props = message.props;
		this.#actionNames = message.actions;
		// Snapshot, so a listener that unsubscribes while being notified cannot skip the next one.
		for (const listener of Array.from(this.#listeners)) listener();
	}

	#runHandleMethod(callId: string, method: string, args: readonly Serializable[]): void {
		void invokeHandleMethod(this.#handle?.[method], method, args).then((outcome) => {
			this.#post(
				outcome.ok
					? { type: 'result', instanceId: this.instanceId, callId, ok: true, value: outcome.value }
					: { type: 'result', instanceId: this.instanceId, callId, ok: false, error: outcome.error },
			);
			return outcome;
		});
	}
}

type HandleOutcome = { ok: true; value: Serializable } | { ok: false; error: ReturnType<typeof serializeError> };

/**
 * Runs a method exposed through `useDOMImperativeHandle` and turns its outcome into a result
 * payload. A method that returns nothing resolves with `null`, because `undefined` has no JSON
 * representation and silently arriving as `null` would be the more surprising behaviour.
 */
async function invokeHandleMethod(
	implementation: HandleMethod | undefined,
	method: string,
	args: readonly Serializable[],
): Promise<HandleOutcome> {
	if (!implementation) {
		return {
			ok: false,
			error: serializeError(
				new DomError(
					DomErrorCode.UnknownHandleMethod,
					`This DOM component does not expose a method named \`${method}\`.`,
					{
						fix: 'Add it to the object returned from `useDOMImperativeHandle`, and check the name for a typo.',
					},
				),
			),
		};
	}

	try {
		const returned = (await implementation(...(args as never[]))) as unknown;
		const value = returned === undefined ? null : returned;
		assertSerializable(value, `the value returned by \`${method}\``, DomErrorCode.NonSerializableResult);
		return { ok: true, value };
	} catch (error) {
		return { ok: false, error: serializeError(error) };
	}
}

function isJsonSafe(value: unknown): value is Serializable {
	try {
		JSON.stringify(value);
		return true;
	} catch {
		return false;
	}
}

function describeForLog(value: unknown): string {
	try {
		return String(value);
	} catch {
		return '[unprintable value]';
	}
}
