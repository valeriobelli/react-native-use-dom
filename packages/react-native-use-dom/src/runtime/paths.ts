/**
 * The URLs both halves of the library agree on. The native side builds them, the bundler
 * integration serves them; keeping them in one module is what stops the two from drifting.
 */

/**
 * The origins release builds serve DOM components from, by platform.
 *
 * Real origins rather than `file://`, so that `localStorage`, `fetch` and module scripts behave the
 * way they do on the web. Nothing is fetched over the network: the native side answers every request
 * from the app bundle. iOS needs a scheme of its own, because WebKit does not let apps answer
 * `https` requests themselves.
 */
export const OFFLINE_ORIGINS = {
	android: 'https://use-dom.localhost',
	ios: 'use-dom://localhost',
} as const

/** A platform DOM components can be rendered on natively. */
export type NativePlatform = keyof typeof OFFLINE_ORIGINS

/** The folder of the app bundle, and path on the offline origin, that pre-built pages live in. */
export const OFFLINE_BUNDLE_DIR = 'dom.bundle'

/** The path the development middleware is mounted at on the React Native dev server. */
export const DEV_MOUNT_PATH = '_dom'

/** The page the WebView loads in development. */
export const DEV_PAGE_PATH = `/${DEV_MOUNT_PATH}/index.html`

/** The generated entry module every DOM component's development bundle starts from. */
export const DEV_ENTRY_PATH = `/${DEV_MOUNT_PATH}/entry.bundle`

/** The platform DOM component bundles are built for. */
export const WEB_PLATFORM = 'web'

/**
 * The key, set from the `resolver.dom` bundle URL parameter, naming the component to build.
 *
 * It travels as a resolver option, not a transform option: Metro keys the transform cache of every
 * file on the transform options, so a component named there would have each module that components
 * share transformed once per component.
 */
export const DOM_RESOLVER_OPTION = 'dom'

/**
 * The transform option Expo's own CLI sets on every DOM component build, with the same value for all of them.
 *
 * Expo's Babel transformer and `babel-preset-expo` read it to select the WebView preset, which
 * compiles for the Android WebView (`@expo/metro-config` `babel-transformer.js:92`, `babel-preset-expo`
 * `build/index.js:36-72`). The value never names a component, so it adds nothing to the transform cache key
 * that differs between components.
 */
export const DOM_TRANSFORM_OPTIONS = { dom: 'true' } as const

/**
 * The development bundle of the component at `file`, as a path and query on the dev server.
 *
 * The page loads it, and the native side requests the same URL ahead of the page, so both must build
 * it the same way: Metro only reuses a build for an identical query.
 */
export function devEntryBundlePath({ dev, file }: { dev: string; file: string }): string {
	const query = new URLSearchParams({
		dev,
		platform: WEB_PLATFORM,
		[`resolver.${DOM_RESOLVER_OPTION}`]: file,
		...Object.fromEntries(Object.entries(DOM_TRANSFORM_OPTIONS).map(([key, value]) => [`transform.${key}`, value])),
	})

	return `${DEV_ENTRY_PATH}?${query.toString()}`
}

/** The websocket DOM components receive Fast Refresh updates on. */
export const DEV_HOT_PATH = `/${DEV_MOUNT_PATH}/hot`

/** The attribute of the script a development page runs its bundle in that holds the bundle's URL. */
export const DEV_BUNDLE_URL_ATTRIBUTE = 'data-bundle-url'
