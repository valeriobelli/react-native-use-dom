import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { BabelTransformer, BabelTransformerArgs, BabelTransformerCacheKeyOptions } from 'metro-babel-transformer'

import { DOM_COMPONENT_SPECIFIER, WEB_ENTRY_PATH } from './dom-component'
import { readWebTransformerSettings } from './web-config'

const MOUNT_MODULE_PATH = require.resolve('../web/mount')
const DEV_CLIENT_MODULE_PATH = require.resolve('../web/dev-client')
const REFRESH_BABEL_PLUGIN = require.resolve('react-refresh/babel')

type BabelPlugins = NonNullable<BabelTransformerArgs['plugins']>

/**
 * Transforms a module of a DOM component bundle.
 *
 * The project's own Babel transformer does the work. In front of it this adds what a web bundle
 * needs and React Native's transformer does not provide: the generated entry module, and Fast
 * Refresh instrumentation of application code in development.
 */
export function transform(args: BabelTransformerArgs): ReturnType<BabelTransformer['transform']> {
	const settings = readWebTransformerSettings()
	const upstream = loadTransformer(settings.upstreamTransformerPath)
	const filePath = path.resolve(args.options.projectRoot, args.filename)
	const isEntry = filePath === WEB_ENTRY_PATH

	return upstream.transform({
		...args,
		plugins: isEntry || !shouldRefresh(args) ? args.plugins : withRefreshPlugin(args.plugins),
		src: isEntry ? synthesizeEntry(args) : args.src,
	})
}

/** Combines the project transformer's key with this file's, so editing either invalidates the cache. */
export function getCacheKey(options?: BabelTransformerCacheKeyOptions): string {
	const settings = readWebTransformerSettings()
	const upstream = loadTransformer(settings.upstreamTransformerPath)

	return createHash('md5')
		.update(readFileSync(__filename))
		.update(JSON.stringify(settings))
		.update(upstream.getCacheKey?.(options) ?? '')
		.digest('hex')
}

/**
 * Metro passes the Babel transformer `hot` only through `getTransformOptions`, never to the
 * transformer itself, so React Native's transformer never instruments anything for Fast Refresh
 * on its own. Dependencies are left alone: they are not edited during development.
 */
function shouldRefresh(args: BabelTransformerArgs): boolean {
	return args.options.dev && !args.filename.includes('node_modules')
}

function withRefreshPlugin(plugins: BabelTransformerArgs['plugins']): BabelPlugins {
	return [...(plugins ?? []), [REFRESH_BABEL_PLUGIN, { skipEnvCheck: true }]]
}

/**
 * The entry module that renders the requested component, replacing the stub's body. In development
 * it starts with the client for Fast Refresh, which has to run before React DOM loads.
 *
 * It depends on the build mode and on nothing else: the component is a fixed specifier that the
 * resolver answers per build, so the transform is shared by every component.
 */
function synthesizeEntry(args: BabelTransformerArgs): string {
	return [
		...(args.options.dev ? [`import ${JSON.stringify(DEV_CLIENT_MODULE_PATH)};`] : []),
		`import Component from ${JSON.stringify(DOM_COMPONENT_SPECIFIER)};`,
		`import { mountDomComponent } from ${JSON.stringify(MOUNT_MODULE_PATH)};`,
		// `StrictMode`'s double render is how a DOM component's effects get the same scrutiny native
		// components already get in development. The flag is written into the entry, rather than read
		// from `process.env` in the page, so the published runtime reads no environment variable.
		`mountDomComponent(Component, { strict: ${JSON.stringify(args.options.dev)} });`,
		'',
	].join('\n')
}

function loadTransformer(modulePath: string): BabelTransformer {
	const loaded = require(modulePath) as BabelTransformer | { __esModule: true; default: BabelTransformer }

	return '__esModule' in loaded && 'default' in loaded ? loaded.default : loaded
}
