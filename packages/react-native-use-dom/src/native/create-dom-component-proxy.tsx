import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { ComponentType, Ref, RefObject } from 'react'

import type { ConsoleMessage } from '../runtime/protocol'
import { splitProps } from '../runtime/split-props'
import { DomWebView } from './dom-web-view'
import { NativeDomBridge } from './host-bridge'
import { devBundleUrl, resolveDomSource } from './source'
import type { DomComponentHandle, DomProps, Serializable } from './types'
import { warmDomBundle } from './warm-bundle'
import type { RNUseDomWebViewMethods } from './web-view'

/** What identifies the `'use dom'` module a proxy renders, as the Babel plugin writes it. */
export interface DomComponentProxyOptions {
	/** Absolute path of the `'use dom'` module this proxy stands in for. */
	filePath: string
	/** Name of the pre-built page next to the JS bundle. Written by the Babel plugin on release. */
	bundleFile?: string
}

/** Stable default, so a component rendered without a `dom` prop does not see a new object each render. */
const NO_DOM_PROPS: DomProps = {}

interface ProxyProps {
	dom?: DomProps
	ref?: Ref<DomComponentHandle>
	[key: string]: unknown
}

/**
 * Builds the component a `'use dom'` module turns into on the native side.
 *
 * The Babel plugin erases the module's own code for native builds and replaces it with a call to
 * this function, so application code imports and renders the result exactly as if it were the
 * original component.
 */
export function createDomComponentProxy(options: DomComponentProxyOptions): ComponentType<ProxyProps> {
	const componentName = describeComponent(options.filePath)

	startDevBuild({ filePath: options.filePath })

	function DomComponent({ dom = NO_DOM_PROPS, ref, ...rest }: ProxyProps) {
		const { bridge, view } = useNativeBridge()

		const { data: props, actions } = splitProps(rest, componentName)
		// Hermes has no `toSorted`, and `Object.keys` returns a fresh array, so sorting it in place is safe.
		const actionNames = useMemo(() => Object.keys(actions).sort(), [actions])

		bridge.setActions(actions)

		const { contentHeight, mounted } = useBridgeCallbacks({ actionNames, bridge, dom, props })

		// The payload the page reads before its first script runs, so the first paint already has
		// real data. Frozen at mount: later changes travel as messages, which is what keeps a prop
		// change from reloading the WebView.
		const injectedObjectJson = useConstant(() =>
			JSON.stringify({ actions: actionNames, instanceId: bridge.instanceId, props }),
		)

		useDomLifecycle(bridge, props, actionNames)
		useImperativeHandle(ref, () => createHandleProxy(bridge), [bridge])

		const page = useMemo(() => resolveDomSource(options), [])

		return (
			<DomWebView
				bridge={bridge}
				componentName={componentName}
				dom={dom}
				contentHeight={contentHeight}
				mounted={mounted}
				injectedObjectJson={injectedObjectJson}
				{...page}
				viewRef={view}
			/>
		)
	}

	DomComponent.displayName = componentName

	return DomComponent
}

/**
 * Asks the dev server to build the component, unless its page is pre-built. Called when the component
 * is imported rather than when it renders, so that the dev server is often done building it by the
 * time a screen shows it.
 */
function startDevBuild({ filePath }: { filePath: string }): void {
	const url = devBundleUrl({ filePath })

	if (url) {
		warmDomBundle({ url })
	}
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
		bridge.open()

		return () => {
			bridge.dispose()
		}
	}, [bridge])

	useEffect(() => {
		bridge.sendProps(props, actionNames)
		// Compared by value, because a render produces a new props object every time.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [bridge, JSON.stringify(props), actionNames])
}

/** The bridge to the page, and the native view it pushes messages into. */
function useNativeBridge(): { bridge: NativeDomBridge; view: RefObject<RNUseDomWebViewMethods | null> } {
	const instanceId = useId()
	const view = useRef<RNUseDomWebViewMethods | null>(null)
	const bridge = useConstant(
		() =>
			new NativeDomBridge(instanceId, (eventName, payload) => {
				view.current?.dispatchMessage(eventName, payload)
			}),
	)

	return { bridge, view }
}

/**
 * Computes a value once and keeps it for the component's whole lifetime.
 *
 * `useState`'s lazy initializer rather than a ref, so nothing is read during render: the bridge and
 * the injected payload must both survive every re-render unchanged.
 */
function useConstant<T>(create: () => T): T {
	const [value] = useState(create)

	return value
}

/**
 * Keeps the bridge's callbacks pointing at the current render, so an action added or removed
 * between renders takes effect on the next message rather than the next mount. Returns what the
 * page has reported about itself.
 */
function useBridgeCallbacks({
	actionNames,
	bridge,
	dom,
	props,
}: {
	actionNames: readonly string[]
	bridge: NativeDomBridge
	dom: DomProps
	props: Record<string, Serializable>
}): { contentHeight: number | null; mounted: boolean } {
	const [contentHeight, setContentHeight] = useState<number | null>(null)
	const [mounted, setMounted] = useState(false)
	const onConsole = useCallback((level: ConsoleMessage['level'], args: readonly Serializable[]) => {
		console[level](...args)
	}, [])

	// The page is as wide as the view, whatever it shows: only its height is the content's own.
	const onResize = (_width: number, height: number) => {
		setContentHeight(height)
	}

	bridge.setCallbacks({
		onConsole,
		onMounted: () => {
			setMounted(true)
			dom.onLoad?.()
		},
		// The page can load before the first props message is sent, so it asks for them itself. A page
		// that reports ready again has reloaded, and shows nothing until it mounts again.
		onReady: () => {
			setMounted(false)
			bridge.sendProps(props, actionNames)
		},
		...(dom.matchContents ? { onResize } : {}),
		onUncaughtError: (error) => {
			reportUncaughtError({ dom, error })
		},
	})

	return { contentHeight, mounted }
}

function reportUncaughtError({ dom, error }: { dom: DomProps; error: Error }): void {
	if (dom.onError) {
		dom.onError(error)

		return
	}

	// Without an `onError` handler, an error that escaped the DOM component would otherwise
	// leave nothing but a blank view.
	// oxlint-disable-next-line no-console
	console.error(error)
}

/**
 * Turns every property read on the ref into a call into the DOM component, so a component's
 * imperative handle needs no declaration on the native side.
 */
function createHandleProxy(bridge: NativeDomBridge): DomComponentHandle {
	return new Proxy(
		{},
		{
			get: (target, property): unknown => {
				// A symbol read is something the runtime is doing to the object itself — `Symbol.toString`,
				// promise unwrapping — never a method call from application code.
				if (typeof property !== 'string') {
					return Reflect.get(target, property)
				}

				return (...args: readonly unknown[]) => bridge.callHandle(property, args)
			},
		},
	)
}

/** A readable name for error messages: the module's file name without its extension. */
function describeComponent(filePath: string): string {
	const fileName = filePath.split('/').pop() ?? filePath

	return fileName.replace(/\.[^.]+$/u, '')
}
