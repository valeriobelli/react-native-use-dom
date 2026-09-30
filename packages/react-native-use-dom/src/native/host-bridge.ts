import { DomError, DomErrorCode } from '../runtime/errors';
import { PendingCalls } from '../runtime/pending-calls';
import type { ConsoleMessage, DomToNativeMessage, NativeToDomMessage, ResultMessage } from '../runtime/protocol';
import { decodeMessage, encodeMessage, nativeEventName } from '../runtime/protocol';
import { assertSerializable } from '../runtime/serializable';
import type { Serializable } from '../runtime/serializable';
import type { NativeAction } from '../runtime/split-props';
import { deserializeError, serializeError } from '../runtime/wire-error';

export interface HostBridgeCallbacks {
	/** The DOM content reported a new size. Only used when `matchContents` is on. */
	onResize?: (width: number, height: number) => void;
	/** The DOM component logged something. */
	onConsole?: (level: ConsoleMessage['level'], args: readonly Serializable[]) => void;
	/** An error escaped the DOM component. */
	onUncaughtError?: (error: Error) => void;
	/** The DOM runtime finished mounting and is ready to receive props. */
	onReady?: () => void;
}

/**
 * The native half of the bridge for one DOM component instance.
 *
 * It owns no React state and no native handle: it is given a way to send a string into the page and
 * is handed every string that comes back, which is what makes the whole protocol testable without a
 * device.
 */
export class NativeDomBridge {
	readonly instanceId: string;

	readonly #eventName: string;
	readonly #send: (eventName: string, payload: string) => void;
	readonly #calls = new PendingCalls();
	#actions: Record<string, NativeAction> = {};
	#callbacks: HostBridgeCallbacks = {};
	#closed = false;

	constructor(instanceId: string, send: (eventName: string, payload: string) => void) {
		this.instanceId = instanceId;
		this.#eventName = nativeEventName(instanceId);
		this.#send = send;
	}

	/** Replaces the function props the DOM side may call. */
	setActions(actions: Record<string, NativeAction>): void {
		this.#actions = actions;
	}

	setCallbacks(callbacks: HostBridgeCallbacks): void {
		this.#callbacks = callbacks;
	}

	/** Sends the current props. Sent on every render and again whenever the DOM side reports ready. */
	sendProps(props: Record<string, Serializable>, actionNames: readonly string[]): void {
		this.#post({ type: 'props', instanceId: this.instanceId, props, actions: actionNames });
	}

	/**
	 * Calls a method the DOM component exposed through `useDOMImperativeHandle` and resolves with
	 * what it returned.
	 */
	callHandle(method: string, args: readonly unknown[]): Promise<Serializable> {
		args.forEach((arg, index) => {
			assertSerializable(arg, `argument ${index + 1} of \`${method}\``, DomErrorCode.NonSerializableArgument);
		});

		const { callId, result } = this.#calls.create();
		this.#post({
			type: 'handle-call',
			instanceId: this.instanceId,
			callId,
			method,
			args: args as Serializable[],
		});
		return result;
	}

	/** Handles one `window.ReactNativeWebView.postMessage` string from the page. */
	receive(raw: string): void {
		if (this.#closed) return;

		const message = decodeMessage<DomToNativeMessage>(raw);
		if (message.instanceId !== this.instanceId) return;

		switch (message.type) {
			case 'ready':
				this.#callbacks.onReady?.();
				break;
			case 'action-call':
				this.#runAction(message.callId, message.action, message.args);
				break;
			case 'result':
				this.#calls.settle(message as ResultMessage);
				break;
			case 'resize':
				this.#callbacks.onResize?.(message.width, message.height);
				break;
			case 'console':
				this.#callbacks.onConsole?.(message.level, message.args);
				break;
			case 'uncaught-error':
				this.#callbacks.onUncaughtError?.(deserializeError(message.error));
				break;
			default:
				break;
		}
	}

	/** Rejects everything still in flight. Called when the component unmounts. */
	dispose(): void {
		this.#closed = true;
		this.#calls.abortAll('the DOM component was unmounted');
	}

	#post(message: NativeToDomMessage): void {
		if (this.#closed) return;
		this.#send(this.#eventName, encodeMessage(message));
	}

	#runAction(callId: string, name: string, args: readonly Serializable[]): void {
		void invokeAction(this.#actions[name], name, args).then((outcome) => {
			this.#post(
				outcome.ok
					? { type: 'result', instanceId: this.instanceId, callId, ok: true, value: outcome.value }
					: { type: 'result', instanceId: this.instanceId, callId, ok: false, error: outcome.error },
			);
			return outcome;
		});
	}
}

type ActionOutcome = { ok: true; value: Serializable } | { ok: false; error: ReturnType<typeof serializeError> };

/**
 * Runs a native action on behalf of the DOM side. A prop that has since been removed is reported as
 * an unknown action rather than left to time out, which is the failure a developer can actually act
 * on.
 */
async function invokeAction(
	action: NativeAction | undefined,
	name: string,
	args: readonly Serializable[],
): Promise<ActionOutcome> {
	if (typeof action !== 'function') {
		return {
			ok: false,
			error: serializeError(
				new DomError(DomErrorCode.UnknownAction, `\`${name}\` is not a native action on this DOM component.`, {
					fix: 'Native actions are the function props the component was rendered with. Check the name, and that the prop is still being passed.',
				}),
			),
		};
	}

	try {
		const returned = (await action(...(args as never[]))) as unknown;
		const value = returned === undefined ? null : returned;
		assertSerializable(value, `the value returned by \`${name}\``, DomErrorCode.NonSerializableResult);
		return { ok: true, value };
	} catch (error) {
		return { ok: false, error: serializeError(error) };
	}
}
