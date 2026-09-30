import path from 'node:path';

import type { ConfigT } from 'metro-config';
import type { CustomResolutionContext, CustomResolver, Resolution } from 'metro-resolver';

import { DomError, DomErrorCode } from '../runtime/errors';

/** The platform DOM bundles are built for. */
export const WEB_PLATFORM = 'web';

/**
 * The environment variable the web Babel transformer reads its settings from.
 *
 * Metro hands a Babel transformer only a fixed set of options, never the transformer config, so
 * settings cannot travel through `metro.config.js`. Metro forks its transform workers with a copy
 * of `process.env` taken when the bundler starts, which makes the environment the one channel
 * that reaches every worker as well as in-band transforms.
 */
export const WEB_TRANSFORMER_ENV = 'RN_USE_DOM_WEB_TRANSFORMER';

/** What the web Babel transformer needs to know about the project. */
export interface WebTransformerSettings {
	/** Absolute path of the Babel transformer the project uses for its native bundle. */
	upstreamTransformerPath: string;
	/** Directories a DOM component may be built from: the project root and its watch folders. */
	allowedRoots: readonly string[];
}

/** The package root, which Metro must watch because the generated entry lives in it. */
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

/** The Babel transformer that runs in front of the project's own for DOM bundles. */
const WEB_TRANSFORMER_PATH = require.resolve('./transformer');

/** Suffix that keeps web transforms out of the native bundle's cache entries. */
const CACHE_VERSION_SUFFIX = 'react-native-use-dom:web';

const REACT_NATIVE_SPECIFIER = /^react-native(?:\/|$)/u;
const REACT_NATIVE_PACKAGE_PATH = /[/\\]node_modules[/\\]react-native[/\\]/u;

/**
 * Derives the configuration of the Metro instance that builds DOM bundles from the project's own.
 *
 * Everything the project customised about resolution (`resolveRequest`, `extraNodeModules`,
 * `blockList`, `watchFolders`, extensions) carries over. What changes is what React Native's
 * defaults assume about a native runtime: the `react-native` export condition and main field,
 * the JS polyfills and the setup module run before the entry, and the preference for `.native.*`
 * files. A DOM bundle runs in a browser engine and gets none of them.
 *
 * Calling this publishes the settings the web Babel transformer reads, so it must run in the
 * process that starts the web bundler, before it starts.
 */
export function createWebConfig(config: ConfigT): ConfigT {
	const settings: WebTransformerSettings = {
		upstreamTransformerPath: resolveUpstreamTransformer(config),
		allowedRoots: unique([config.projectRoot, ...config.watchFolders]),
	};
	process.env[WEB_TRANSFORMER_ENV] = JSON.stringify(settings);

	return {
		...config,
		cacheVersion: `${config.cacheVersion}:${CACHE_VERSION_SUFFIX}`,
		watchFolders: unique([...config.watchFolders, PACKAGE_ROOT]),
		resolver: {
			...config.resolver,
			platforms: unique([...config.resolver.platforms, WEB_PLATFORM]),
			resolverMainFields: ['browser', 'module', 'main'],
			// `browser` comes from `unstable_conditionsByPlatform.web`; a global list would also
			// apply it to the native bundle's resolution if the two configs were ever shared.
			unstable_conditionNames: config.resolver.unstable_conditionNames.filter(
				(condition) => condition !== 'react-native',
			),
			unstable_conditionsByPlatform: {
				...config.resolver.unstable_conditionsByPlatform,
				[WEB_PLATFORM]: config.resolver.unstable_conditionsByPlatform[WEB_PLATFORM] ?? ['browser'],
			},
			resolveRequest: createWebResolver(config.resolver.resolveRequest),
		},
		serializer: {
			...config.serializer,
			getPolyfills: () => [],
			polyfillModuleNames: [],
			getModulesRunBeforeMainModule: () => [],
			// A framework serializer (Expo's, for one) shapes output for its own web runtime; DOM
			// bundles are loaded by the page this library generates.
			customSerializer: null,
		},
		transformer: {
			...config.transformer,
			babelTransformerPath: WEB_TRANSFORMER_PATH,
		},
		server: {
			...config.server,
			// The web instance is never served on its own: requests reach it already routed.
			enhanceMiddleware: (middleware) => middleware,
			rewriteRequestUrl: (url) => url,
		},
	};
}

/** Reads the settings {@link createWebConfig} published for the web Babel transformer. */
export function readWebTransformerSettings(): WebTransformerSettings {
	const raw = process.env[WEB_TRANSFORMER_ENV];
	if (raw === undefined) {
		throw new DomError(DomErrorCode.MissingMetroConfig, 'The DOM component transformer ran without its settings.', {
			fix: "DOM bundles are built by the bundler `withDom()` starts. Wrap your Metro config with `withDom` from 'react-native-use-dom/metro' instead of pointing Metro at the transformer directly.",
		});
	}
	return JSON.parse(raw) as WebTransformerSettings;
}

/**
 * Wraps the project's resolver so that DOM bundles resolve the way a browser would, and so that
 * reaching `react-native` from one fails at build time rather than as a crash in the WebView.
 */
export function createWebResolver(upstream: CustomResolver | null | undefined): CustomResolver {
	return (context, moduleName, platform) => {
		if (REACT_NATIVE_SPECIFIER.test(moduleName)) {
			throw reactNativeImport(context.originModulePath, moduleName);
		}

		// Metro always resolves with `preferNativePlatform: true`, which would pick `.native.*`
		// files ahead of plain ones. Nothing native exists in a DOM bundle.
		const webContext: CustomResolutionContext = { ...context, preferNativePlatform: false };
		const resolution = (upstream ?? context.resolveRequest)(webContext, moduleName, platform);

		// An alias (`extraNodeModules`, a custom resolver) can reach React Native under another name.
		if (resolvesIntoReactNative(resolution)) {
			throw reactNativeImport(context.originModulePath, moduleName);
		}
		return resolution;
	};
}

function resolvesIntoReactNative(resolution: Resolution): boolean {
	return resolution.type === 'sourceFile' && REACT_NATIVE_PACKAGE_PATH.test(resolution.filePath);
}

function reactNativeImport(originModulePath: string, moduleName: string): DomError {
	return new DomError(
		DomErrorCode.ReactNativeImportInDom,
		`${originModulePath} imports '${moduleName}', but it is part of a DOM component bundle, which runs in a browser where React Native does not exist.`,
		{
			fix: "Use DOM elements and web libraries inside 'use dom' modules. To use a native capability, pass a function prop from the native side and call it from the DOM component.",
		},
	);
}

function resolveUpstreamTransformer(config: ConfigT): string {
	return require.resolve(config.transformer.babelTransformerPath, { paths: [config.projectRoot] });
}

function unique<T>(values: readonly T[]): T[] {
	return [...new Set(values)];
}
