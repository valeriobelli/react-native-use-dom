import path from 'node:path';

import { getDefaultConfig } from '@react-native/metro-config';
import { buildGraph } from 'metro';
import type { ConfigT } from 'metro-config';
import { mergeConfig } from 'metro-config';
import type { CustomResolutionContext, CustomResolver, Resolution } from 'metro-resolver';

import { DomErrorCode } from '../runtime/errors';
import { createWebConfig, createWebResolver, readWebTransformerSettings, WEB_TRANSFORMER_ENV } from './web-config';

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'web-project');
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const EXTRA_WATCH_FOLDER = path.join(FIXTURE_ROOT, 'vendor');
const silentReporter = { update: () => {} };

/** A project resolver that aliases a module, the way apps do with `resolveRequest`. */
const userResolver: CustomResolver = (context, moduleName, platform) =>
	moduleName === 'aliased-platform'
		? context.resolveRequest(context, './platform', platform)
		: context.resolveRequest(context, moduleName, platform);

const resolved: Resolution = { type: 'sourceFile', filePath: '/app/node_modules/react-dom/index.js' };

function fakeContext(resolveRequest: CustomResolver): CustomResolutionContext {
	return {
		originModulePath: '/app/Chart.tsx',
		preferNativePlatform: true,
		resolveRequest,
	} as CustomResolutionContext;
}

const aliasIntoReactNative = (): Resolution => ({
	type: 'sourceFile',
	filePath: '/app/node_modules/react-native/index.js',
});

/**
 * The fixture's `metro.config.js` as Metro loads it: React Native's defaults plus the customisations a
 * project makes, with the project root first among the watch folders.
 */
function projectConfig(): ConfigT {
	return mergeConfig(getDefaultConfig(FIXTURE_ROOT), {
		cacheStores: [],
		maxWorkers: 1,
		reporter: silentReporter,
		watchFolders: [FIXTURE_ROOT, EXTRA_WATCH_FOLDER],
		resolver: {
			blockList: [/ignored-dir/u],
			extraNodeModules: { 'dual-pkg': path.join(FIXTURE_ROOT, 'vendor', 'dual-pkg') },
			resolveRequest: userResolver,
			useWatchman: false,
		},
	});
}

async function resolvedPaths(config: ConfigT, entry: string): Promise<string[]> {
	const graph = await buildGraph(config, { entries: [path.join(FIXTURE_ROOT, entry)], platform: 'web' });
	return [...graph.dependencies.keys()].map((file) => path.relative(FIXTURE_ROOT, file)).toSorted();
}

afterEach(() => {
	delete process.env[WEB_TRANSFORMER_ENV];
});

describe('createWebConfig', () => {
	it('removes the native runtime assumptions of React Native defaults', () => {
		const web = createWebConfig(projectConfig());

		expect(web.resolver.platforms).toEqual(['android', 'ios', 'web']);
		expect(web.resolver.resolverMainFields).toEqual(['browser', 'module', 'main']);
		expect(web.resolver.unstable_conditionNames).toEqual([]);
		expect(web.resolver.unstable_conditionsByPlatform['web']).toEqual(['browser']);
		expect(web.serializer.getPolyfills({ platform: 'web' })).toEqual([]);
		expect(web.serializer.getModulesRunBeforeMainModule('/entry.js')).toEqual([]);
		expect(web.transformer.babelTransformerPath).toBe(require.resolve('./transformer'));
	});

	it('preserves resolver customisations and watches the package', () => {
		const project = projectConfig();
		const web = createWebConfig(project);

		expect(web.resolver.blockList).toBe(project.resolver.blockList);
		expect(web.resolver.extraNodeModules).toBe(project.resolver.extraNodeModules);
		expect(web.resolver.useWatchman).toBe(false);
		expect(web.watchFolders).toEqual([FIXTURE_ROOT, EXTRA_WATCH_FOLDER, PACKAGE_ROOT]);
		expect(web.cacheVersion).not.toBe(project.cacheVersion);
	});

	it('publishes the project transformer for the web transformer to wrap', () => {
		const project = projectConfig();
		createWebConfig(project);

		expect(readWebTransformerSettings()).toEqual({
			upstreamTransformerPath: project.transformer.babelTransformerPath,
			allowedRoots: [FIXTURE_ROOT, EXTRA_WATCH_FOLDER],
		});
	});

	it('resolves browser fields and never native platform files', async () => {
		const paths = await resolvedPaths(createWebConfig(projectConfig()), 'index.js');

		expect(paths).toEqual(['index.js', 'platform.js', path.join('vendor', 'dual-pkg', 'browser.js')]);
	});

	it('fails the build when a DOM bundle imports react-native, naming the importer', async () => {
		const build = resolvedPaths(createWebConfig(projectConfig()), 'imports-react-native.js');

		await expect(build).rejects.toMatchObject({
			code: DomErrorCode.ReactNativeImportInDom,
			message: expect.stringContaining(path.join(FIXTURE_ROOT, 'imports-react-native.js')),
		});
	});
});

describe('createWebResolver', () => {
	it.each(['react-native', 'react-native/Libraries/Image/Image'])('rejects %s', (moduleName) => {
		expect(() => createWebResolver(null)(fakeContext(jest.fn()), moduleName, 'web')).toThrow(
			expect.objectContaining({
				code: DomErrorCode.ReactNativeImportInDom,
				message: expect.stringContaining('/app/Chart.tsx'),
			}),
		);
	});

	it('allows packages that only share the prefix', () => {
		const next = jest.fn(() => resolved);

		expect(createWebResolver(null)(fakeContext(next), 'react-native-web', 'web')).toBe(resolved);
	});

	it('rejects an alias that lands inside react-native', () => {
		expect(() => createWebResolver(aliasIntoReactNative)(fakeContext(jest.fn()), 'rn-alias', 'web')).toThrow(
			expect.objectContaining({ code: DomErrorCode.ReactNativeImportInDom }),
		);
	});

	it('delegates to the project resolver without the native platform preference', () => {
		const upstream = jest.fn<Resolution, Parameters<CustomResolver>>(() => resolved);
		const fallback = jest.fn();

		expect(createWebResolver(upstream)(fakeContext(fallback), 'react-dom', 'web')).toBe(resolved);
		expect(fallback).not.toHaveBeenCalled();
		expect(upstream.mock.calls[0]?.[0].preferNativePlatform).toBe(false);
	});
});
