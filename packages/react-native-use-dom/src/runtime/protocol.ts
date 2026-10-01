import { DomError, DomErrorCode } from './errors'
import type { Serializable } from './serializable'
import type { WireError } from './wire-error'

/**
 * The wire protocol version. Both runtimes are shipped together inside one app binary, so this
 * exists to fail loudly on a stale cached DOM bundle rather than to support mixed versions.
 */
export const PROTOCOL_VERSION = 1

/**
 * The global the DOM runtime posts through. Deliberately the same name `react-native-webview` uses,
 * so existing web code written against `window.ReactNativeWebView.postMessage` keeps working.
 */
export const POST_MESSAGE_GLOBAL = 'ReactNativeWebView'

/**
 * Name of the `CustomEvent` the native side dispatches into the document.
 *
 * Every message is scoped by the receiving component's `instanceId`, so two DOM components mounted
 * on one screen never observe each other's traffic.
 */
export function nativeEventName(instanceId: string): string {
	return `rn-use-dom:${instanceId}`
}

/** Sent by the DOM runtime once it has mounted and is able to receive props. */
export interface ReadyMessage {
	type: 'ready'
	instanceId: string
	protocolVersion: number
}

/** Native → DOM: the current value of every serializable prop. */
export interface PropsMessage {
	type: 'props'
	instanceId: string
	props: Record<string, Serializable>
	/** Names of the props that are native actions, so the DOM side can build callable stubs. */
	actions: readonly string[]
}

/** DOM → native: invoke a function prop. */
export interface ActionCallMessage {
	type: 'action-call'
	instanceId: string
	callId: string
	action: string
	args: readonly Serializable[]
}

/** Native → DOM: invoke a method exposed through `useDOMImperativeHandle`. */
export interface HandleCallMessage {
	type: 'handle-call'
	instanceId: string
	callId: string
	method: string
	args: readonly Serializable[]
}

/** The settled outcome of a call, in either direction. */
export type ResultMessage =
	| { type: 'result'; instanceId: string; callId: string; ok: true; value: Serializable }
	| { type: 'result'; instanceId: string; callId: string; ok: false; error: WireError }

/** DOM → native: the content's measured size, used by `matchContents`. */
export interface ResizeMessage {
	type: 'resize'
	instanceId: string
	width: number
	height: number
}

/** DOM → native: a console call, forwarded so it lands in the app's terminal. */
export interface ConsoleMessage {
	type: 'console'
	instanceId: string
	level: 'log' | 'info' | 'warn' | 'error' | 'debug'
	args: readonly Serializable[]
}

/** DOM → native: an uncaught error or rejection inside the DOM runtime. */
export interface UncaughtErrorMessage {
	type: 'uncaught-error'
	instanceId: string
	error: WireError
}

/** Anything the DOM runtime may send to the native side. */
export type DomToNativeMessage =
	| ReadyMessage
	| ActionCallMessage
	| ResultMessage
	| ResizeMessage
	| ConsoleMessage
	| UncaughtErrorMessage

/** Anything the native side may send to the DOM runtime. */
export type NativeToDomMessage = PropsMessage | HandleCallMessage | ResultMessage

/** Serializes a message for transport. Both directions use JSON text. */
export function encodeMessage(message: DomToNativeMessage | NativeToDomMessage): string {
	return JSON.stringify(message)
}

/**
 * Parses and validates a message off the wire.
 *
 * The WebView is a separate runtime that a page could in principle reach; every field is checked
 * rather than trusted, and a bad frame throws {@link DomErrorCode.MalformedMessage} instead of
 * corrupting state further along.
 */
export function decodeMessage<T extends DomToNativeMessage | NativeToDomMessage>(raw: string): T {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch (cause) {
		throw new DomError(DomErrorCode.MalformedMessage, 'A DOM component sent a non-JSON message.', {
			cause,
			fix: 'This usually means something other than this library is posting to `window.ReactNativeWebView`.',
		})
	}

	if (typeof parsed !== 'object' || parsed === null) {
		throw malformed(`expected an object, received ${parsed === null ? 'null' : typeof parsed}`)
	}
	const message = parsed as Record<string, unknown>
	if (typeof message['type'] !== 'string') throw malformed('`type` is missing or not a string')
	if (typeof message['instanceId'] !== 'string') {
		throw malformed('`instanceId` is missing or not a string')
	}
	return message as T
}

function malformed(detail: string): DomError {
	return new DomError(
		DomErrorCode.MalformedMessage,
		`A DOM component sent a message this library does not understand: ${detail}.`,
		{ fix: 'Check that no other code is posting to `window.ReactNativeWebView.postMessage`.' },
	)
}
