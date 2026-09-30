import type { ComponentType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { Serializable } from '../runtime/serializable';

/**
 * Configuration for the native view a DOM component renders into, passed as the reserved `dom`
 * prop. Every other prop is forwarded to the DOM component itself.
 *
 * ```tsx
 * <Chart data={points} dom={{ matchContents: true }} />
 * ```
 */
export interface DomProps {
	/**
	 * Sizes the native view to the rendered content, remeasuring as the content changes — including
	 * after fonts and images finish loading.
	 *
	 * Leave it off when the component should fill the space its parent gives it; a component that
	 * lays out at zero height in both directions is usually this flag missing.
	 *
	 * @default false
	 */
	matchContents?: boolean;

	/** Style applied to the native view. Sizing here wins over the DOM content's own size. */
	style?: StyleProp<ViewStyle>;

	/**
	 * Background colour of the native view, in any format React Native accepts. It shows before the
	 * first paint and wherever the page itself is transparent. A `backgroundColor` in `style` wins.
	 *
	 * @default 'white'
	 */
	backgroundColor?: string;

	/**
	 * Allows the content to be scrolled by the user. Turn it off for a component that lays itself
	 * out to fit, so that a drag reaches the native `ScrollView` it sits inside.
	 *
	 * @default true
	 */
	scrollEnabled?: boolean;

	/**
	 * Called when the DOM component tries to navigate away from its own page — a link with an
	 * external `href`, a `window.location` assignment. The navigation is always blocked; this is
	 * where an app opens the URL itself, in a browser or an in-app tab.
	 */
	onNavigationBlocked?: (url: string) => void;

	/** Called once the DOM component has mounted and painted for the first time. */
	onLoad?: () => void;

	/**
	 * Called when the DOM component fails to load or throws an error that escapes it. Without this,
	 * such an error surfaces as a development overlay and is logged in release.
	 */
	onError?: (error: Error) => void;

	/** `testID` for the native view, for use from an end-to-end test. */
	testID?: string;
}

/**
 * The props a native caller passes: the DOM component's own props plus the reserved `dom` prop.
 *
 * Function props become native actions — the DOM side calls them and awaits the result — so their
 * arguments and return values must be JSON-serializable. Every other prop must be serializable
 * outright: `children` is not supported, because the DOM component's tree lives in the WebView.
 */
export type DomComponentProps<TProps> = TProps & { dom?: DomProps };

/**
 * The type of a `'use dom'` module's default export as seen from native code: the component's own
 * props, plus `dom`, plus a `ref` carrying whatever the component exposed through
 * `useDOMImperativeHandle`.
 */
export type DomComponent<TProps, THandle extends DomComponentHandle = Record<string, never>> = ComponentType<
	DomComponentProps<TProps> & { ref?: React.Ref<THandle> }
>;

/**
 * Methods reachable through a DOM component's `ref`. Every call crosses into the WebView, so each
 * one is asynchronous even when its DOM-side implementation is not.
 */
export type DomComponentHandle = Record<string, (...args: never[]) => Promise<Serializable>>;
