import { DomError, DomErrorCode } from '../runtime/errors'
import { POST_MESSAGE_GLOBAL } from '../runtime/protocol'
import type { Serializable } from '../runtime/serializable'

/** What the native side injects into the page before the bundle runs. */
export interface InjectedPayload {
	instanceId: string
	props: Record<string, Serializable>
	actions: readonly string[]
}

interface ReactNativeWebViewGlobal {
	postMessage(message: string): void
	injectedObjectJson?: () => string | undefined
}

export function readWebViewGlobal(): ReactNativeWebViewGlobal {
	const value = (globalThis as Record<string, unknown>)[POST_MESSAGE_GLOBAL]

	if (typeof value === 'object' && !!value && 'postMessage' in value) {
		return value as ReactNativeWebViewGlobal
	}

	throw new DomError(DomErrorCode.BridgeClosed, 'This DOM component is not running inside a React Native WebView.', {
		fix: `A '"use dom"' module can only be mounted by this library: opening the bundle directly in a browser leaves \`window.${POST_MESSAGE_GLOBAL}\` undefined.`,
	})
}

/**
 * Reads the props the native side injected before the bundle ran.
 *
 * Reading them synchronously is what lets the first paint already show real data (E3-AC1); the
 * native side also re-sends them once the bridge reports ready, which closes the race where the
 * page loaded before the props were set.
 */
export function readInjectedPayload(): InjectedPayload {
	const raw = readWebViewGlobal().injectedObjectJson?.()

	if (!raw) {
		throw new DomError(DomErrorCode.MalformedMessage, 'The DOM component was mounted without its initial props.', {
			fix: 'This is an internal inconsistency; please report it with the app and library versions.',
		})
	}

	return JSON.parse(raw) as InjectedPayload
}
