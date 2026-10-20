import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ConfigT } from 'metro-config'
import type Server from 'metro/private/Server'

import { domBundleFileName } from './bundle-file'
import { DOM_RESOLVER_OPTION, DOM_TRANSFORM_OPTIONS, WEB_ENTRY_PATH } from './dom-component'
import type { Metro } from './host-metro'
import { renderPage } from './page'
import { copyPublicDirectory, publicDirectory } from './public-directory'
import { createWebConfig, WEB_PLATFORM } from './web-config'

/**
 * Builds each component's page into `outputDirectory`, replacing whatever an earlier build left.
 *
 * Pages are built for production whatever the native bundle is: an app that loads its bundle from
 * the app has no dev server to reach. They carry no source map and nothing that points outside the
 * app. The project's `public` folder is copied next to them, for pages to load by relative URL.
 */
export async function buildPages({
	components,
	config,
	metro,
	outputDirectory,
}: {
	components: readonly string[]
	config: ConfigT
	metro: Metro
	outputDirectory: string
}): Promise<void> {
	const server = new metro.Server(createWebConfig(config, metro), { watch: false })

	try {
		await server.ready()
		await rm(outputDirectory, { force: true, recursive: true })
		await mkdir(outputDirectory, { recursive: true })
		// Before the pages, which take precedence over a public file of the same name.
		await copyPublicDirectory(publicDirectory(config.projectRoot), outputDirectory)
		const defaults = { ...metro.Server.DEFAULT_BUNDLE_OPTIONS }

		// Metro does not de-duplicate transforms that are in flight, so builds started together all miss
		// the cache on the modules they share. The first page transforms them; the others find them cached.
		const [first, ...rest] = components

		if (first) {
			await buildPage({ component: first, defaults, outputDirectory, server })
		}

		await Promise.all(rest.map((component) => buildPage({ component, defaults, outputDirectory, server })))
	} finally {
		await server.end()
	}
}

async function buildPage({
	component,
	defaults,
	outputDirectory,
	server,
}: {
	component: string
	defaults: typeof Server.DEFAULT_BUNDLE_OPTIONS
	outputDirectory: string
	server: Server
}): Promise<void> {
	const page = domBundleFileName(component)
	const script = page.replace(/\.html$/u, '.js')

	const { code } = await server.build({
		...defaults,
		// The component is named to the resolver, not to the transformer: a transform option is part of
		// the cache key of every module, so each module the pages share would be transformed once per page.
		customResolverOptions: { [DOM_RESOLVER_OPTION]: component },
		customTransformOptions: DOM_TRANSFORM_OPTIONS,
		dev: false,
		entryFile: WEB_ENTRY_PATH,
		minify: true,
		platform: WEB_PLATFORM,
	})

	await Promise.all([
		writeFile(path.join(outputDirectory, script), code),
		writeFile(path.join(outputDirectory, page), renderPage(`<script src="${script}"></script>`)),
	])
}
