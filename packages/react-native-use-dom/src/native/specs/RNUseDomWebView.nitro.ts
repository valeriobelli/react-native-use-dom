import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules'

/**
 * The native view a DOM component renders into.
 *
 * This is not a general-purpose WebView and is not part of the public API. It carries exactly what
 * the DOM runtime needs: a page to load, the props to hand it before its first script runs, and a
 * string channel in each direction. The view is transparent, so whatever is behind it shows until
 * the page paints. Everything else — prop updates, native actions, imperative handles, sizing —
 * rides over that channel as protocol messages rather than as native props.
 */
export interface RNUseDomWebViewProps extends HybridViewProps {
	/** The page to load: the dev server's DOM entry, or the offline bundle's own origin. */
	source: string

	/**
	 * The JSON the page reads synchronously as `window.ReactNativeWebView.injectedObjectJson()`,
	 * before the bundle's first script runs. This is what lets the first paint show real data.
	 */
	injectedObjectJson: string

	/** Whether the user can scroll the content, rather than the surrounding native scroll view. */
	scrollEnabled: boolean

	/** Whether to expose the page to Safari Web Inspector and Chrome DevTools. */
	inspectable: boolean

	/** Receives every `window.ReactNativeWebView.postMessage` string from the page. */
	onMessage: (message: string) => void

	/** Called once the page has loaded. Failures come through {@linkcode onLoadError} instead. */
	onLoadEnd: () => void

	/** Called with a human-readable reason when the page could not be loaded. */
	onLoadError: (reason: string) => void

	/**
	 * Called with the URL of a navigation that was blocked. Navigation away from the component's
	 * own page is always refused; this only reports it, so the app can decide what to do.
	 */
	onNavigationBlocked: (url: string) => void
}

export interface RNUseDomWebViewMethods extends HybridViewMethods {
	/**
	 * Dispatches a `CustomEvent` into the page, which is how every native → DOM message arrives.
	 *
	 * The event name is passed in rather than derived natively, because it is scoped to the DOM
	 * component instance and only the JavaScript side knows that scope.
	 */
	dispatchMessage(eventName: string, payload: string): void

	/** Reloads the page. Used when a Fast Refresh update cannot be applied in place. */
	reload(): void
}

export type RNUseDomWebView = HybridView<RNUseDomWebViewProps, RNUseDomWebViewMethods>
