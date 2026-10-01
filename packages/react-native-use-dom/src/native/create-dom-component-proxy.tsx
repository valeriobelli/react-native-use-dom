import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ComponentType, RefObject, Ref } from 'react';
import { View } from 'react-native';

import type { ConsoleMessage } from '../runtime/protocol';
import type { Serializable } from '../runtime/serializable';
import { splitProps } from '../runtime/split-props';
import { NativeDomBridge } from './host-bridge';
import { resolveDomSource } from './source';
import type { DomComponentHandle, DomProps } from './types';
import { loadNativeView } from './web-view';
import type { RNUseDomWebViewMethods } from './web-view';
import { useZeroHeightCheck } from './zero-height';

/** What identifies the `'use dom'` module a proxy renders, as the Babel plugin writes it. */
export interface DomComponentProxyOptions {
	/** Absolute path of the `'use dom'` module this proxy stands in for. */
	filePath: string;
	/** Name of the pre-built page inside the app bundle. Written by the Babel plugin on release. */
	bundleFile?: string;
}

const FILL_PARENT = { flex: 1 } as const;

/** Stable default, so a component rendered without a `dom` prop does not see a new object each render. */
const NO_DOM_PROPS: DomProps = {};

interface ProxyProps {
	dom?: DomProps;
	ref?: Ref<DomComponentHandle>;
	[key: string]: unknown;
}

/**
 * Builds the component a `'use dom'` module turns into on the native side.
 *
 * The Babel plugin erases the module's own code for native builds and replaces it with a call to
 * this function, so application code imports and renders the result exactly as if it were the
 * original component.
 */
export function createDomComponentProxy(options: DomComponentProxyOptions): ComponentType<ProxyProps> {
	const componentName = describeComponent(options.filePath);

	function DomComponent({ dom = NO_DOM_PROPS, ref, ...rest }: ProxyProps) {
		const instanceId = useId();
		const view = useRef<RNUseDomWebViewMethods | null>(null);
		const bridge = useConstant(
			() =>
				new NativeDomBridge(instanceId, (eventName, payload) => {
					view.current?.dispatchMessage(eventName, payload);
				}),
		);

		const { data: props, actions } = splitProps(rest, componentName);
		// Hermes has no `toSorted`, and `Object.keys` returns a fresh array, so sorting it in place is safe.
		const actionNames = useMemo(() => Object.keys(actions).sort(), [actions]);
		bridge.setActions(actions);

		const [contentHeight, setContentHeight] = useState<number | null>(null);
		useBridgeCallbacks(bridge, dom, props, actionNames, setContentHeight);

		// The payload the page reads before its first script runs, so the first paint already has
		// real data. Frozen at mount: later changes travel as messages, which is what keeps a prop
		// change from reloading the WebView.
		const injectedObjectJson = useConstant(() => JSON.stringify({ instanceId, props, actions: actionNames }));

		useDomLifecycle(bridge, props, actionNames);
		useImperativeHandle(ref, () => createHandleProxy(bridge), [bridge]);

		const source = useMemo(() => resolveDomSource(options), []);

		return (
			<DomWebView
				bridge={bridge}
				componentName={componentName}
				dom={dom}
				contentHeight={contentHeight}
				injectedObjectJson={injectedObjectJson}
				source={source}
				viewRef={view}
			/>
		);
	}

	DomComponent.displayName = componentName;
	return DomComponent;
}

/**
 * Sends props whenever they change, and rejects anything still in flight on unmount.
 *
 * Props travel as messages rather than as native props, which is what lets a prop change re-render
 * the DOM tree without reloading the page.
 */
function useDomLifecycle(
	bridge: NativeDomBridge,
	props: Record<string, Serializable>,
	actionNames: readonly string[],
): void {
	// First, so that the bridge is open again before the props effect below sends, when React re-runs
	// both without unmounting: during Fast Refresh, and once after mounting in Strict Mode.
	useEffect(() => {
		bridge.open();
		return () => {
			bridge.dispose();
		};
	}, [bridge]);

	useEffect(() => {
		bridge.sendProps(props, actionNames);
		// Compared by value, because a render produces a new props object every time.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [bridge, JSON.stringify(props), actionNames]);
}

/**
 * Computes a value once and keeps it for the component's whole lifetime.
 *
 * `useState`'s lazy initializer rather than a ref, so nothing is read during render: the bridge and
 * the injected payload must both survive every re-render unchanged.
 */
function useConstant<T>(create: () => T): T {
	const [value] = useState(create);
	return value;
}

/**
 * Keeps the bridge's callbacks pointing at the current render, so an action added or removed
 * between renders takes effect on the next message rather than the next mount.
 */
function useBridgeCallbacks(
	bridge: NativeDomBridge,
	dom: DomProps,
	props: Record<string, Serializable>,
	actionNames: readonly string[],
	setContentHeight: (height: number) => void,
): void {
	const onConsole = useCallback((level: ConsoleMessage['level'], args: readonly Serializable[]) => {
		console[level](...args);
	}, []);

	// The page is as wide as the view, whatever it shows: only its height is the content's own.
	const onResize = (_width: number, height: number) => {
		setContentHeight(height);
	};

	bridge.setCallbacks({
		// The page can load before the first props message is sent, so it asks for them itself.
		onReady: () => {
			bridge.sendProps(props, actionNames);
		},
		...(dom.matchContents ? { onResize } : {}),
		onConsole,
		onUncaughtError: (error) => {
			if (dom.onError) {
				dom.onError(error);
				return;
			}
			// Without an `onError` handler, an error that escaped the DOM component would otherwise
			// leave nothing but a blank view.
			// oxlint-disable-next-line no-console
			console.error(error);
		},
	});
}

/**
 * Turns every property read on the ref into a call into the DOM component, so a component's
 * imperative handle needs no declaration on the native side.
 */
function createHandleProxy(bridge: NativeDomBridge): DomComponentHandle {
	return new Proxy({} as DomComponentHandle, {
		get(target, property) {
			// A symbol read is something the runtime is doing to the object itself — `Symbol.toString`,
			// promise unwrapping — never a method call from application code.
			if (typeof property !== 'string') return Reflect.get(target, property);
			return (...args: readonly unknown[]) => bridge.callHandle(property, args);
		},
	});
}

/** A readable name for error messages: the module's file name without its extension. */
function describeComponent(filePath: string): string {
	const fileName = filePath.split('/').pop() ?? filePath;
	return fileName.replace(/\.[^.]+$/u, '');
}

interface DomWebViewProps {
	bridge: NativeDomBridge;
	componentName: string;
	dom: DomProps;
	contentHeight: number | null;
	injectedObjectJson: string;
	source: string;
	viewRef: RefObject<RNUseDomWebViewMethods | null>;
}

/**
 * Renders the native view. Separated from the component above so that everything crossing into
 * Nitro — including the `callback(...)` wrapping every function prop needs — reads in one place.
 *
 * The style goes on a plain view around the WebView, which fills it: on Android, a Nitro view on
 * React Native 0.86 or newer receives none of the base view props, such as `backgroundColor`,
 * `opacity` or `testID` (https://github.com/margelo/nitro/issues/1656).
 */
function DomWebView({
	bridge,
	componentName,
	contentHeight,
	dom,
	injectedObjectJson,
	source,
	viewRef,
}: DomWebViewProps) {
	const { RNUseDomWebView, callback } = loadNativeView();
	const { style, webViewStyle, onLayout } = useViewStyles(componentName, dom, contentHeight);

	return (
		<View
			style={style}
			{...(__DEV__ ? { onLayout } : {})}
			{...(dom.testID === undefined ? {} : { testID: dom.testID })}
		>
			<RNUseDomWebView
				source={source}
				injectedObjectJson={injectedObjectJson}
				scrollEnabled={dom.scrollEnabled ?? true}
				inspectable={__DEV__}
				style={webViewStyle}
				hybridRef={callback((instance: RNUseDomWebViewMethods) => {
					holdNativeView(viewRef, instance);
				})}
				onMessage={callback((message: string) => {
					bridge.receive(message);
				})}
				onLoadEnd={callback(() => {
					dom.onLoad?.();
				})}
				onLoadError={callback((reason: string) => {
					dom.onError?.(new Error(reason));
				})}
				onNavigationBlocked={callback((url: string) => {
					dom.onNavigationBlocked?.(url);
				})}
			/>
		</View>
	);
}

/**
 * The styles of the view and of the WebView inside it, and the layout listener that, in development,
 * outlines a view with no height.
 */
function useViewStyles(componentName: string, dom: DomProps, contentHeight: number | null) {
	const { debugStyle, onLayout } = useZeroHeightCheck(componentName, dom.matchContents ?? false);
	const style = useMemo(
		() => [
			{ backgroundColor: dom.backgroundColor ?? 'white' },
			dom.matchContents ? null : FILL_PARENT,
			dom.style,
			debugStyle,
		],
		[dom.backgroundColor, dom.matchContents, dom.style, debugStyle],
	);
	// Sized inside the view's own style, so that its borders and padding add to the content's size.
	const webViewStyle = useMemo(
		() => (dom.matchContents ? { height: contentHeight ?? 0 } : FILL_PARENT),
		[dom.matchContents, contentHeight],
	);
	return { style, webViewStyle, onLayout };
}

/**
 * Stores the native view handle Nitro hands back.
 *
 * A module-level function rather than an inline assignment, because the handle is the one thing
 * this component holds that has nothing to do with rendering: it exists so that messages can be
 * pushed into the page between renders.
 */
function holdNativeView(ref: RefObject<RNUseDomWebViewMethods | null>, instance: RNUseDomWebViewMethods): void {
	ref.current = instance;
}
