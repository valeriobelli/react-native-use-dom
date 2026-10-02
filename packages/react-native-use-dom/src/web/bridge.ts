import { DomError, DomErrorCode } from '../runtime/errors'
import { PendingCalls } from '../runtime/pending-calls'
import { decodeMessage, encodeMessage, nativeEventName, PROTOCOL_VERSION } from '../runtime/protocol'
import type { DomToNativeMessage, NativeToDomMessage, PropsMessage } from '../runtime/protocol'
import { assertSerializable } from '../runtime/serializable'
import type { Serializable } from '../runtime/serializable'
import { serializeError } from '../runtime/wire-error'
import { readWebViewGlobal, type InjectedPayload } from './injected-payload'

export { readInjectedPayload, type InjectedPayload } from './injected-payload'

/** A method exposed to the native side through `useDOMImperativeHandle`. */
export type HandleMethod = (...args: never[]) => unknown

export interface DomBridge {
	readonly instanceId: string
	/** Current props, updated in place before subscribers are notified. */
	getProps(): Record<string, Serializable>
	/** Names of the props that are native actions. */
	getActionNames(): readonly string[]
	/** Subscribes to prop updates. Returns an unsubscribe function. */
	subscribe(listener: () => void): () => void
	/** Calls a native action and resolves with whatever it returned. */
	callAction(name: string, args: readonly unknown[]): Promise<Serializable>
	/** Replaces the methods the native side may call through the component's ref. */
	setHandle(methods: Record<string, HandleMethod> | null): void
	/** Reports the content's measured size, for `matchContents`. */
	reportSize(width: number, height: number): void
	/** Forwards a console call so it lands in the app's terminal. */
	reportConsole(level: 'log' | 'info' | 'warn' | 'error' | 'debug', args: readonly unknown[]): void
	/** Reports an error that escaped the DOM component. */
	reportUncaughtError(error: unknown): void
	/** Stops listening. Used when the page is torn down. */
	dispose(): void
}

/**
 * Creates the DOM side of the bridge for one component instance.
 *
 * Every message is scoped by `instanceId`, so several DOM components on one screen never observe
 * each other's traffic.
 */
export function createDomBridge(payload: InjectedPayload): DomBridge {
	return new WebDomBridge(payload)
}

class WebDomBridge implements DomBridge {
	readonly instanceId: string

	readonly #webView = readWebViewGlobal()
	readonly #calls = new PendingCalls()
	readonly #listeners = new Set<() => void>()
	readonly #eventName: string
	readonly #onNativeEvent: (event: Event) => void

	#props: Record<string, Serializable>
	#actionNames: readonly string[]
	#handle: Record<string, HandleMethod> | null = null

	constructor(payload: InjectedPayload) {
		this.instanceId = payload.instanceId
		this.#props = payload.props
		this.#actionNames = payload.actions

		this.#eventName = nativeEventName(payload.instanceId)

		this.#onNativeEvent = (event) => {
			this.#receive((event as CustomEvent<string>).detail)
		}

		globalThis.addEventListener(this.#eventName, this.#onNativeEvent)

		this.#post({
			instanceId: this.instanceId,
			protocolVersion: PROTOCOL_VERSION,
			type: 'ready',
		})
	}

	// Bound, because these three are read as standalone functions: `useSyncExternalStore` takes
	// `subscribe` and `getProps` detached from the object.
	readonly getProps = (): Record<string, Serializable> => this.#props

	readonly getActionNames = (): readonly string[] => this.#actionNames

	readonly subscribe = (listener: () => void): (() => void) => {
		this.#listeners.add(listener)

		return () => {
			this.#listeners.delete(listener)
		}
	}

	// The `async` keyword turns the validation throws below into rejections, which is the contract.
	// oxlint-disable-next-line typescript/require-await
	async callAction(name: string, args: readonly unknown[]): Promise<Serializable> {
		if (!this.#actionNames.includes(name)) {
			throw new DomError(DomErrorCode.UnknownAction, `\`${name}\` is not a native action on this DOM component.`, {
				fix: 'Native actions are the function props the component was rendered with. Check the name, and that the prop is still being passed.',
			})
		}

		args.forEach((arg, index) => {
			assertSerializable(arg, `argument ${index + 1} of \`${name}\``, DomErrorCode.NonSerializableArgument)
		})

		const { callId, result } = this.#calls.create()

		this.#post({
			action: name,
			args: args as Serializable[],
			callId,
			instanceId: this.instanceId,
			type: 'action-call',
		})

		return result
	}

	setHandle(methods: Record<string, HandleMethod> | null): void {
		this.#handle = methods
	}

	reportSize(width: number, height: number): void {
		this.#post({ height, instanceId: this.instanceId, type: 'resize', width })
	}

	reportConsole(level: 'log' | 'info' | 'warn' | 'error' | 'debug', args: readonly unknown[]): void {
		// Forwarding a log must never itself throw, so an unprintable argument is described instead.
		const safe = args.map((arg) => (isJsonSafe(arg) ? arg : describeForLog(arg)))

		this.#post({
			args: safe,
			instanceId: this.instanceId,
			level,
			type: 'console',
		})
	}

	reportUncaughtError(error: unknown): void {
		this.#post({ error: serializeError(error), instanceId: this.instanceId, type: 'uncaught-error' })
	}

	dispose(): void {
		globalThis.removeEventListener(this.#eventName, this.#onNativeEvent)
		this.#listeners.clear()
		this.#calls.abortAll('the DOM component was torn down')
	}

	#post(message: DomToNativeMessage): void {
		// This is the WebView's own message channel, not `window.postMessage`: it takes a single string and has no target origin.
		// oxlint-disable-next-line unicorn/require-post-message-target-origin
		this.#webView.postMessage(encodeMessage(message))
	}

	#receive(raw: string): void {
		const message = decodeMessage(raw) as NativeToDomMessage

		if (message.instanceId !== this.instanceId) {
			return
		}

		switch (message.type) {
			case 'props':
				this.#applyProps(message)
				break
			case 'result':
				this.#calls.settle(message)
				break
			case 'handle-call':
				this.#runHandleMethod(message.callId, message.method, message.args)
				break
			default:
				break
		}
	}

	#applyProps(message: PropsMessage): void {
		this.#props = message.props
		this.#actionNames = message.actions
		// Snapshot, so a listener that unsubscribes while being notified cannot skip the next one.

		for (const listener of Array.from(this.#listeners)) {
			listener()
		}
	}

	#runHandleMethod(callId: string, method: string, args: readonly Serializable[]): void {
		void invokeHandleMethod(this.#handle?.[method], method, args).then((outcome) => {
			this.#post(
				outcome.ok
					? { callId, instanceId: this.instanceId, ok: true, type: 'result', value: outcome.value }
					: { callId, error: outcome.error, instanceId: this.instanceId, ok: false, type: 'result' },
			)

			return outcome
		})
	}
}

type HandleOutcome = { ok: true; value: Serializable } | { ok: false; error: ReturnType<typeof serializeError> }

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
			error: serializeError(
				new DomError(
					DomErrorCode.UnknownHandleMethod,
					`This DOM component does not expose a method named \`${method}\`.`,
					{
						fix: 'Add it to the object returned from `useDOMImperativeHandle`, and check the name for a typo.',
					},
				),
			),
			ok: false,
		}
	}

	try {
		const returned = await implementation(...(args as never[]))
		const value = returned === undefined ? null : returned

		assertSerializable(value, `the value returned by \`${method}\``, DomErrorCode.NonSerializableResult)

		return { ok: true, value }
	} catch (error) {
		return { error: serializeError(error), ok: false }
	}
}

function isJsonSafe(value: unknown): value is Serializable {
	try {
		JSON.stringify(value)

		return true
	} catch {
		return false
	}
}

function describeForLog(value: unknown): string {
	try {
		return String(value)
	} catch {
		return '[unprintable value]'
	}
}
