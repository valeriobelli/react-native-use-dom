import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import type { TransformResult } from 'metro/private/DeltaBundler/types'
import type { TransformerConfig, TransformOptions } from 'metro/private/DeltaBundler/Worker'

import { readWebTransformerSettings } from './web-config'

type WorkerConfig = TransformerConfig['transformerConfig']

/** What Metro loads from `transformerPath`. */
interface TransformWorker {
	transform(
		config: WorkerConfig,
		projectRoot: string,
		filename: string,
		data: Buffer,
		options: TransformOptions,
	): Promise<TransformResult>
	getCacheKey?(config: WorkerConfig, opts?: { projectRoot: string }): string
}

/** The attribute that ties a `<style>` element to the stylesheet it holds. */
export const STYLESHEET_ATTRIBUTE = 'data-use-dom-css'

const STYLESHEET = /\.css$/u

/**
 * Transforms a file of a DOM component bundle.
 *
 * The project's own worker does the work. In front of it this turns a stylesheet into a module that
 * applies it to the page, the way a browser would apply a `<link>`: Metro has no notion of CSS, and
 * a framework's worker that has one (Expo's) leaves the styles for its own serializer to collect,
 * which DOM bundles are not built with.
 */
export function transform(
	config: WorkerConfig,
	projectRoot: string,
	filename: string,
	data: Buffer,
	options: TransformOptions,
): Promise<TransformResult> {
	const upstream = loadWorker(readWebTransformerSettings().upstreamWorkerPath)

	if (options.type === 'asset' || !STYLESHEET.test(filename)) {
		return upstream.transform(config, projectRoot, filename, data, options)
	}

	// Named as a script, so that the upstream worker compiles it as one rather than as a stylesheet.
	const source = stylesheetModule(filename, data.toString('utf8'))

	return upstream.transform(config, projectRoot, `${filename}.js`, Buffer.from(source), options)
}

/** Combines the project worker's key with this file's, so editing either invalidates the cache. */
export function getCacheKey(config: WorkerConfig, opts?: { projectRoot: string }): string {
	const { upstreamWorkerPath } = readWebTransformerSettings()

	return createHash('md5')
		.update(readFileSync(__filename))
		.update(readFileSync(upstreamWorkerPath))
		.update(loadWorker(upstreamWorkerPath).getCacheKey?.(config, opts) ?? '')
		.digest('hex')
}

/**
 * The module a stylesheet becomes: it puts the styles in a `<style>` element of its own, in import
 * order. Running it again, as a hot update does, replaces the styles in place.
 */
export function stylesheetModule(filename: string, css: string): string {
	return `var id = ${JSON.stringify(filename)};
var style = Array.prototype.find.call(document.head.querySelectorAll("style[${STYLESHEET_ATTRIBUTE}]"), function (element) {
	return element.getAttribute(${JSON.stringify(STYLESHEET_ATTRIBUTE)}) === id;
});
if (!style) {
	style = document.createElement("style");
	style.setAttribute(${JSON.stringify(STYLESHEET_ATTRIBUTE)}, id);
	document.head.appendChild(style);
}
style.textContent = ${JSON.stringify(css)};
`
}

function loadWorker(modulePath: string): TransformWorker {
	return require(modulePath) as TransformWorker
}
