import { DomError, DomErrorCode } from './errors'
import type { ResultMessage } from './protocol'
import type { Serializable } from './serializable'
import { deserializeError } from './wire-error'

/**
 * Correlates in-flight calls with the results that come back for them.
 *
 * Both directions use this: the DOM runtime awaiting a native action, and the native side awaiting
 * a method exposed through `useDOMImperativeHandle`. Results may arrive in any order, so each call
 * is keyed rather than queued.
 */
export class PendingCalls {
	readonly #pending = new Map<string, { resolve: (value: Serializable) => void; reject: (error: Error) => void }>()
	#nextId = 0

	/** Registers a call and returns its id together with the promise its result will settle. */
	create(): { callId: string; result: Promise<Serializable> } {
		this.#nextId += 1
		const callId = String(this.#nextId)
		const result = new Promise<Serializable>((resolve, reject) => {
			this.#pending.set(callId, { reject, resolve })
		})

		return { callId, result }
	}

	/**
	 * Settles the call a result belongs to.
	 *
	 * @returns `true` if the result matched a call. A `false` means the result was late (the caller
	 * already gave up) or duplicated; the caller decides whether that is worth reporting.
	 */
	settle(message: ResultMessage): boolean {
		const entry = this.#pending.get(message.callId)

		if (!entry) {
			return false
		}

		this.#pending.delete(message.callId)

		if (message.ok) {
			entry.resolve(message.value)
		} else {
			entry.reject(deserializeError(message.error))
		}

		return true
	}

	/**
	 * Rejects every outstanding call, used when the WebView goes away and no result can ever arrive.
	 *
	 * @param reason what happened, appended to the error message.
	 */
	abortAll(reason: string): void {
		const entries = [...this.#pending.values()]

		this.#pending.clear()
		const error = new DomError(DomErrorCode.BridgeClosed, `A call to a DOM component could not complete: ${reason}.`, {
			fix: 'Calls do not survive the component unmounting; cancel them when the screen goes away.',
		})

		for (const entry of entries) {
			entry.reject(error)
		}
	}

	/** How many calls are still awaiting a result. */
	get size(): number {
		return this.#pending.size
	}
}
