import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { BabelTransformer, BabelTransformerArgs, BabelTransformerCacheKeyOptions } from 'metro-babel-transformer';

import { DomError, DomErrorCode } from '../runtime/errors';
import type { WebTransformerSettings } from './web-config';
import { readWebTransformerSettings } from './web-config';

/** The file every DOM component bundle is requested with as its entry. */
export const WEB_ENTRY_PATH = require.resolve('../web/entry');

/** The key, set from the `transform.dom` bundle URL parameter, naming the component to build. */
export const DOM_TRANSFORM_OPTION = 'dom';

const MOUNT_MODULE_PATH = require.resolve('../web/mount');
const REFRESH_BABEL_PLUGIN = require.resolve('react-refresh/babel');

type BabelPlugins = NonNullable<BabelTransformerArgs['plugins']>;

/**
 * Transforms a module of a DOM component bundle.
 *
 * The project's own Babel transformer does the work. In front of it this adds what a web bundle
 * needs and React Native's transformer does not provide: the generated entry module, and Fast
 * Refresh instrumentation of application code in development.
 */
export function transform(args: BabelTransformerArgs): ReturnType<BabelTransformer['transform']> {
	const settings = readWebTransformerSettings();
	const upstream = loadTransformer(settings.upstreamTransformerPath);
	const filePath = path.resolve(args.options.projectRoot, args.filename);
	const isEntry = filePath === WEB_ENTRY_PATH;

	return upstream.transform({
		...args,
		src: isEntry ? synthesizeEntry(args, settings) : args.src,
		plugins: isEntry || !shouldRefresh(args) ? args.plugins : withRefreshPlugin(args.plugins),
	});
}

/** Combines the project transformer's key with this file's, so editing either invalidates the cache. */
export function getCacheKey(options?: BabelTransformerCacheKeyOptions): string {
	const settings = readWebTransformerSettings();
	const upstream = loadTransformer(settings.upstreamTransformerPath);
	return createHash('md5')
		.update(readFileSync(__filename))
		.update(JSON.stringify(settings))
		.update(upstream.getCacheKey?.(options) ?? '')
		.digest('hex');
}

/**
 * Metro passes the Babel transformer `hot` only through `getTransformOptions`, never to the
 * transformer itself, so React Native's transformer never instruments anything for Fast Refresh
 * on its own. Dependencies are left alone: they are not edited during development.
 */
function shouldRefresh(args: BabelTransformerArgs): boolean {
	return args.options.dev && !args.filename.includes('node_modules');
}

function withRefreshPlugin(plugins: BabelTransformerArgs['plugins']): BabelPlugins {
	return [...(plugins ?? []), [REFRESH_BABEL_PLUGIN, { skipEnvCheck: true }]];
}

/** The entry module that renders the requested component, replacing the stub's body. */
function synthesizeEntry(args: BabelTransformerArgs, settings: WebTransformerSettings): string {
	const componentPath = readRequestedComponent(args, settings);
	return [
		`import Component from ${JSON.stringify(componentPath)};`,
		`import { mountDomComponent } from ${JSON.stringify(MOUNT_MODULE_PATH)};`,
		'mountDomComponent(Component);',
		'',
	].join('\n');
}

/**
 * The component path arrives in a URL anyone who can reach the dev server can craft, so it is
 * only honoured for files Metro would serve anyway: the project and its watch folders.
 */
function readRequestedComponent(args: BabelTransformerArgs, settings: WebTransformerSettings): string {
	const requested = args.options.customTransformOptions?.[DOM_TRANSFORM_OPTION];

	if (typeof requested !== 'string' || !path.isAbsolute(requested)) {
		throw new DomError(
			DomErrorCode.UnknownDomComponent,
			'A DOM component bundle was requested without naming its component.',
			{
				fix: 'DOM component pages are requested by the native view with the absolute path of the component. Load them through a DOM component rather than by URL.',
			},
		);
	}

	const componentPath = path.normalize(requested);
	if (!settings.allowedRoots.some((root) => isInside(root, componentPath))) {
		throw new DomError(
			DomErrorCode.UnknownDomComponent,
			`${componentPath} was requested as a DOM component, but it is outside the project and its watch folders.`,
			{
				fix: 'Only files Metro serves can be DOM components. Move the component into the project, or add its directory to `watchFolders` in metro.config.js.',
			},
		);
	}
	return componentPath;
}

function isInside(root: string, filePath: string): boolean {
	const relative = path.relative(root, filePath);
	return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function loadTransformer(modulePath: string): BabelTransformer {
	const loaded = require(modulePath) as BabelTransformer | { __esModule: true; default: BabelTransformer };
	return '__esModule' in loaded && 'default' in loaded ? loaded.default : (loaded as BabelTransformer);
}
