import { createRequire } from 'node:module'
import path from 'node:path'

import type { getDefaultConfig, mergeConfig } from 'metro-config'
import type baseJSBundle from 'metro/private/DeltaBundler/Serializers/baseJSBundle'
import type HmrServer from 'metro/private/HmrServer'
import type bundleToString from 'metro/private/lib/bundleToString'
import type createWebsocketServer from 'metro/private/lib/createWebsocketServer'
import type formatBundlingError from 'metro/private/lib/formatBundlingError'
import type Server from 'metro/private/Server'

/** The Metro modules the DOM bundler is built from, all from one copy of Metro. */
export interface Metro {
	Server: typeof Server
	HmrServer: typeof HmrServer
	createWebsocketServer: typeof createWebsocketServer
	formatBundlingError: typeof formatBundlingError
	baseJSBundle: typeof baseJSBundle
	bundleToString: typeof bundleToString
	getDefaultConfig: typeof getDefaultConfig
	mergeConfig: typeof mergeConfig
	/** Resolves a module the way this Metro's own code does, which is how it loads `transformerPath`. */
	resolve: (request: string) => string
}

/** The module cache, as `require.cache` holds it. */
export type ModuleCache = Record<string, { exports?: unknown } | undefined>

/** Metro's `Server` module, wherever the package is installed. */
const SERVER_MODULE = /[\\/]metro[\\/]src[\\/]Server\.js$/u

/**
 * The Metro that runs the app's bundler, which the DOM bundler must match: its config, transformer
 * and serializer are written for that version.
 *
 * It is not always the copy this package resolves: tooling can bring its own Metro (Expo CLI runs
 * the one `@expo/metro` ships), while a package manager that installs peer dependencies itself
 * (pnpm) gives this package another. So the modules are loaded from the copy `server` was built
 * from or, without a server, from the one copy the process has loaded, and from this package's own
 * copy only when neither is known.
 *
 * @param server - The dev server Metro hands to `enhanceMiddleware`.
 */
export function hostMetro(server?: object): Metro {
	const load = createRequire(findHostMetroPackage(require.cache, server) ?? __filename)
	const { default: MetroServer } = load('metro/private/Server') as { default: typeof Server }
	const { getDefaultConfig: defaults, mergeConfig: merge } = load('metro-config') as {
		getDefaultConfig: typeof getDefaultConfig
		mergeConfig: typeof mergeConfig
	}
	return {
		Server: MetroServer,
		HmrServer: defaultExport(load('metro/private/HmrServer')),
		createWebsocketServer: defaultExport(load('metro/private/lib/createWebsocketServer')),
		formatBundlingError: defaultExport(load('metro/private/lib/formatBundlingError')),
		baseJSBundle: defaultExport(load('metro/private/DeltaBundler/Serializers/baseJSBundle')),
		bundleToString: defaultExport(load('metro/private/lib/bundleToString')),
		getDefaultConfig: defaults,
		mergeConfig: merge,
		resolve: (request) => load.resolve(request),
	}
}

/**
 * The `package.json` of the Metro package whose `Server` built `server` or, without one, of the only
 * Metro whose `Server` is in `cache`. `undefined` when there is no such package, or several.
 */
export function findHostMetroPackage(cache: ModuleCache, server?: object): string | undefined {
	const loaded = Object.keys(cache).filter((file) => SERVER_MODULE.test(file))
	const match =
		server === undefined
			? loaded.find(() => loaded.length === 1)
			: loaded.find(
					(file) => (cache[file]?.exports as { default?: unknown } | undefined)?.default === server.constructor,
				)
	return match === undefined ? undefined : path.join(path.dirname(match), '..', 'package.json')
}

function defaultExport<T>(module: unknown): T {
	return (module as { default: T }).default
}
