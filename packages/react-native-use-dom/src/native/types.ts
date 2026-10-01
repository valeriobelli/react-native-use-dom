import type { ComponentType, Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import type { Serializable } from '../runtime/serializable'

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
	 * Sizes the native view's height to the rendered content, remeasuring as the content changes —
	 * including after fonts and images finish loading. The width comes from layout, as for any view:
	 * the page is as wide as the view it renders in.
	 *
	 * Leave it off when the component should fill the space its parent gives it; a component that
	 * lays out at zero height in both directions is usually this flag missing.
	 *
	 * @default false
	 */
	matchContents?: boolean

	/** Style applied to the native view. Sizing here wins over the DOM content's own size. */
	style?: StyleProp<ViewStyle>

	/**
	 * Background colour of the native view, in any format React Native accepts. It shows before the
	 * first paint and wherever the page itself is transparent. A `backgroundColor` in `style` wins.
	 *
	 * @default 'white'
	 */
	backgroundColor?: string

	/**
	 * Allows the content to be scrolled by the user. Turn it off for a component that lays itself
	 * out to fit, so that a drag reaches the native `ScrollView` it sits inside.
	 *
	 * @default true
	 */
	scrollEnabled?: boolean

	/**
	 * Called when the DOM component tries to navigate away from its own page — a link with an
	 * external `href`, a `window.location` assignment. The navigation is always blocked; this is
	 * where an app opens the URL itself, in a browser or an in-app tab.
	 */
	onNavigationBlocked?: (url: string) => void

	/** Called once the DOM component has mounted and painted for the first time. */
	onLoad?: () => void

	/**
	 * Called when the DOM component fails to load or throws an error that escapes it. Without this,
	 * such an error surfaces as a development overlay and is logged in release.
	 */
	onError?: (error: Error) => void

	/** `testID` for the native view, for use from an end-to-end test. */
	testID?: string
}

/**
 * The props a native caller passes: the DOM component's own props plus the reserved `dom` prop.
 *
 * Function props become native actions — the DOM side calls them and awaits the result — so their
 * arguments and return values must be JSON-serializable. Every other prop must be serializable
 * outright: `children` is not supported, because the DOM component's tree lives in the WebView.
 */
export type DomComponentProps<TProps> = TProps & { dom?: DomProps }

/**
 * The type of a `'use dom'` module's default export as seen from native code: the component's own
 * props, plus `dom`, plus a `ref` carrying whatever the component exposed through
 * `useDOMImperativeHandle`.
 */
export type DomComponent<TProps, THandle extends DomComponentHandle = Record<string, never>> = ComponentType<
	DomComponentProps<TProps> & { ref?: React.Ref<THandle> }
>

/**
 * Methods reachable through a DOM component's `ref`. Every call crosses into the WebView, so each
 * one is asynchronous even when its DOM-side implementation is not.
 */
export type DomComponentHandle = Record<string, (...args: never[]) => Promise<Serializable>>

/**
 * A method of a handle as the native side calls it: it crosses into the WebView, so it resolves
 * with the DOM-side result, and with `null` when that returns nothing.
 */
export type DomHandleCall<TMethod> = TMethod extends (...args: infer TArgs) => infer TResult
	? (...args: TArgs) => Promise<Exclude<Awaited<TResult>, void> | (undefined extends Awaited<TResult> ? null : never)>
	: never

/**
 * The type of a DOM component's `ref` prop, for the handle `THandle` it exposes through
 * `useDOMImperativeHandle`. Declaring it among the component's props is what lets native code pass
 * a typed ref:
 *
 * ```tsx
 * 'use dom';
 *
 * export interface EditorHandle {
 *   getText(): string;
 *   clear(): void;
 * }
 *
 * export default function Editor(_: { ref?: DomRef<EditorHandle>; dom?: DomProps }) {
 *   // ...
 * }
 * ```
 *
 * ```tsx
 * const editor = useRef<DomRefHandle<EditorHandle>>(null);
 * const text: string | undefined = await editor.current?.getText();
 * ```
 */
export type DomRef<THandle extends object> = Ref<DomRefHandle<THandle>>

/** What a DOM component's native `ref` holds: every method of `THandle`, called asynchronously. */
export type DomRefHandle<THandle extends object> = { [K in keyof THandle]: DomHandleCall<THandle[K]> }
