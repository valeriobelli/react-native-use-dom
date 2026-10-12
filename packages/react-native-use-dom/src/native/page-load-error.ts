import { DomErrorCode } from '../runtime/errors'
import type { DomLoadErrorKind, DomLoadErrorOptions } from '../runtime/load-error'
import { DomLoadError } from '../runtime/load-error'
import type { DomLoadErrorPayload } from './specs/RNUseDomWebView.nitro'

/** What to tell a developer whose page is missing from the folder next to the running bundle. */
const NOT_FOUND_FIX =
	'Rebuild with `withDom()` in `metro.config.js`, so the page is written to `dom.bundle/` next to the running bundle, and keep `dom.bundle/` beside the bundle in an over-the-air update. The page is never served from the app binary instead.'

/** The code a load failure of this kind carries. */
function codeFor(kind: DomLoadErrorKind): DomErrorCode {
	return kind === 'notFound' ? DomErrorCode.PageNotFound : DomErrorCode.PageLoadFailed
}

/** The message a load failure of this kind carries. */
function messageFor(payload: DomLoadErrorPayload): string {
	if (payload.kind === 'notFound') {
		return `No page was found for the DOM component at ${payload.url}.`
	}

	const status = payload.status === undefined ? '' : ` with HTTP ${payload.status}`

	return `Loading the DOM component's page at ${payload.url} failed${status}: ${payload.description}`
}

/**
 * Builds the {@link DomLoadError} a native load failure becomes: a missing page carries
 * {@link DomErrorCode.PageNotFound} and a fix naming `withDom` and `dom.bundle/`, everything else
 * carries {@link DomErrorCode.PageLoadFailed}.
 */
export function toPageLoadError(payload: DomLoadErrorPayload): DomLoadError {
	const base: DomLoadErrorOptions = {
		kind: payload.kind,
		status: payload.status ?? null,
		url: payload.url,
	}

	return new DomLoadError(
		codeFor(payload.kind),
		messageFor(payload),
		payload.kind === 'notFound' ? { ...base, fix: NOT_FOUND_FIX } : base,
	)
}

/**
 * Hands a native load failure to the component's `dom.onError`, or logs it when there is no handler,
 * so a page that never loaded never leaves a blank view with nothing said about it.
 */
export function reportPageLoadError(payload: DomLoadErrorPayload, onError: ((error: Error) => void) | undefined): void {
	const error = toPageLoadError(payload)

	if (onError) {
		onError(error)

		return
	}

	// oxlint-disable-next-line no-console
	console.error(error)
}
