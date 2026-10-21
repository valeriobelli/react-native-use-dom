import type { RefObject } from 'react'
import { View } from 'react-native'

import type { NativeDomBridge } from './host-bridge'
import { reportPageLoadError } from './page-load-error'
import type { DomProps } from './types'
import { useViewStyles } from './view-style'
import { loadNativeView } from './web-view'
import type { DomLoadErrorPayload, RNUseDomWebViewMethods } from './web-view'

interface DomWebViewProps {
	bridge: NativeDomBridge
	componentName: string
	dom: DomProps
	contentHeight: number | null
	injectedObjectJson: string
	mounted: boolean
	pagesDirectory: string
	source: string
	viewRef: RefObject<RNUseDomWebViewMethods | null>
}

/**
 * Renders the native view. Separated from the proxy so that everything crossing into
 * Nitro — including the `callback(...)` wrapping every function prop needs — reads in one place.
 *
 * The style goes on a plain view around the WebView, which fills it: on Android, a Nitro view on
 * React Native 0.86 or newer receives none of the base view props, such as `backgroundColor`,
 * `opacity` or `testID` (https://github.com/margelo/nitro/issues/1656).
 */
export function DomWebView({
	bridge,
	componentName,
	contentHeight,
	dom,
	injectedObjectJson,
	mounted,
	pagesDirectory,
	source,
	viewRef,
}: DomWebViewProps) {
	const { RNUseDomWebView, callback } = loadNativeView()
	const covered = Boolean(dom.fallback) && !mounted
	const { fallbackStyle, style, webViewStyle, onLayout } = useViewStyles({ componentName, contentHeight, covered, dom })

	return (
		<View
			style={style}
			{...(__DEV__ ? { onLayout } : {})}
			{...(dom.testID === undefined ? {} : { testID: dom.testID })}
		>
			<RNUseDomWebView
				source={source}
				pagesDirectory={pagesDirectory}
				injectedObjectJson={injectedObjectJson}
				scrollEnabled={dom.scrollEnabled ?? true}
				hideKeyboardAccessoryView={dom.hideKeyboardAccessoryView ?? false}
				inspectable={__DEV__}
				style={webViewStyle}
				hybridRef={callback((instance: RNUseDomWebViewMethods) => {
					holdNativeView(viewRef, instance)
				})}
				onMessage={callback((message: string) => {
					bridge.receive(message)
				})}
				// `dom.onLoad` waits for the component to paint instead: in development, the page finishes
				// loading before it has even fetched the component.
				onLoadEnd={callback(() => {})}
				onLoadError={callback((error: DomLoadErrorPayload) => {
					reportPageLoadError({ onError: dom.onError, payload: error })
				})}
				onNavigationBlocked={callback((url: string) => {
					dom.onNavigationBlocked?.(url)
				})}
			/>
			{covered ? <View style={fallbackStyle}>{dom.fallback}</View> : null}
		</View>
	)
}

/**
 * Stores the native view handle Nitro hands back.
 *
 * A module-level function rather than an inline assignment, because the handle is the one thing
 * this component holds that has nothing to do with rendering: it exists so that messages can be
 * pushed into the page between renders.
 */
function holdNativeView(ref: RefObject<RNUseDomWebViewMethods | null>, instance: RNUseDomWebViewMethods): void {
	ref.current = instance
}
