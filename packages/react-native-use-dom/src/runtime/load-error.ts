import type { DomErrorCode, DomErrorOptions } from './errors'
import { DomError } from './errors'

/** Why a {@link DomLoadError} happened, as the native view reports it. */
export type DomLoadErrorKind = 'notFound' | 'http' | 'network' | 'other'

/** What a {@link DomLoadError} carries beyond the code, message and fix of a {@link DomError}. */
export interface DomLoadErrorOptions extends DomErrorOptions {
	/** The URL the native view tried to load. */
	url: string
	/** The HTTP status the page answered with, or `null` when the failure carried none. */
	status?: number | null
	/** Why the load failed. */
	kind: DomLoadErrorKind
}

/**
 * A DOM component's page that failed to load. Raised for every page load failure and passed to
 * `dom.onError`, so an app can tell a missing page from a network error without reading messages.
 *
 * @example
 * ```tsx
 * <Chart
 *   data={points}
 *   dom={{
 *     onError: (error) => {
 *       if (error instanceof DomLoadError && error.kind === 'notFound') {
 *         // the page isn't next to the running bundle: rebuild with `withDom`, or ship it over the air
 *       }
 *     },
 *   }}
 * />
 * ```
 */
export class DomLoadError extends DomError {
	override readonly name: string = 'DomLoadError'
	/** The URL the native view tried to load. */
	readonly url: string
	/** The HTTP status the page answered with, or `null` when the failure carried none. */
	readonly status: number | null
	/** Why the load failed. */
	readonly kind: DomLoadErrorKind

	constructor(code: DomErrorCode, message: string, options: DomLoadErrorOptions) {
		super(code, message, options)
		this.url = options.url
		this.status = options.status ?? null
		this.kind = options.kind
	}
}
