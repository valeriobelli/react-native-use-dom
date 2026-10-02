/**
 * The parts of Metro and React Native this library relies on that neither publishes as API. Each
 * check names the contract it guards, so an upgrade that breaks one says what to fix rather than
 * failing somewhere downstream.
 */
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import type http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { getDefaultConfig } from '@react-native/metro-config'
import { runServer } from 'metro'
import type { ConfigT } from 'metro-config'
import { mergeConfig } from 'metro-config'

jest.setTimeout(60_000)

/** What a failing check reports: the contract's name, and where the library depends on it. */
function breakage(contract: string, dependant: string, holds: boolean): string | undefined {
	return holds ? undefined : `Bundler contract broken: ${contract}. ${dependant} depends on it.`
}

function includesAll(source: string, ...fragments: readonly string[]): boolean {
	return fragments.every((fragment) => source.includes(fragment))
}

function hasOwnFunctions(object: Record<string, unknown>, names: readonly string[]): boolean {
	return names.every((name) => Object.hasOwn(object, name) && typeof object[name] === 'function')
}

/** Whether `candidate` is the config a server started from `config` runs with, once Metro merged in its defaults. */
function isRunConfig(candidate: Partial<ConfigT> | undefined, projectRoot: string, config: ConfigT): boolean {
	return candidate?.projectRoot === projectRoot && candidate.reporter === config.reporter
}

/** A module's default export, or the module itself when it has none; `undefined` when it does not load. */
function loadExport(request: string): unknown {
	try {
		const module = require(request) as { default?: unknown }

		return module.default ?? module
	} catch {
		return undefined
	}
}

function packageFile(request: string, file: string, from = __dirname): string {
	return readFileSync(
		path.join(path.dirname(require.resolve(`${request}/package.json`, { paths: [from] })), file),
		'utf8',
	)
}

const REACT_NATIVE_ROOT = path.dirname(require.resolve('react-native/package.json'))

describe('Metro modules outside its public API', () => {
	it.each([
		['metro/private/Server', 'src/metro/dev-middleware.ts, src/metro/build-pages.ts'],
		['metro/private/HmrServer', 'src/metro/hot-socket.ts'],
		['metro/private/lib/createWebsocketServer', 'src/metro/hot-socket.ts'],
		['metro/private/lib/formatBundlingError', 'src/metro/hot-socket.ts'],
		['metro/private/DeltaBundler/Serializers/baseJSBundle', 'src/metro/release-build.ts'],
		['metro/private/lib/bundleToString', 'src/metro/release-build.ts'],
		['metro-runtime/modules/HMRClient', 'src/web/dev-client.ts'],
	])('%s is a function or class', (request, dependant) => {
		expect(
			breakage(`'${request}' loads, and exports a function`, dependant, typeof loadExport(request) === 'function'),
		).toBeUndefined()
	})

	it('Server keeps its default bundle options on the class', () => {
		const { default: Server } = require('metro/private/Server') as {
			default: { DEFAULT_BUNDLE_OPTIONS?: { dev?: unknown } }
		}

		expect(
			breakage(
				'Server.DEFAULT_BUNDLE_OPTIONS is a bundle options object',
				'src/metro/build-pages.ts',
				typeof Server.DEFAULT_BUNDLE_OPTIONS?.dev === 'boolean',
			),
		).toBeUndefined()
	})
})

describe('a Metro dev server', () => {
	let projectRoot: string
	let config: ConfigT
	let server:
		| {
				_config?: Partial<ConfigT>
				getBundler?: unknown
				getCreateModuleId?: unknown
				ready: () => Promise<void>
				end: () => Promise<void>
		  }
		| undefined
	let httpServer: http.Server

	beforeAll(async () => {
		projectRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'use-dom-contract-')))
		writeFileSync(path.join(projectRoot, 'package.json'), '{ "name": "contract-fixture" }\n')

		config = mergeConfig(getDefaultConfig(projectRoot), {
			cacheStores: [],
			maxWorkers: 1,
			reporter: { update: () => {} },
			resolver: { useWatchman: false },
			server: {
				enhanceMiddleware: (middleware, metroServer) => {
					server = metroServer as typeof server

					return middleware
				},
				port: 0,
			},
		})
		;({ httpServer } = await runServer(config, { host: '127.0.0.1' }))
	})

	afterAll(async () => {
		await new Promise((resolve) => {
			httpServer.close(resolve)
		})
		await server?.ready()
		await server?.end()
		rmSync(projectRoot, { force: true, recursive: true })
	})

	it('hands enhanceMiddleware the server, carrying the config it runs with', () => {
		expect(
			breakage(
				'the server passed to enhanceMiddleware has `_config`, the resolved config',
				'src/metro/with-dom.ts',
				// Metro exposes the config a server runs with only through this field.
				// oxlint-disable-next-line no-underscore-dangle
				isRunConfig(server?._config, projectRoot, config),
			),
		).toBeUndefined()
	})

	it('exposes what an HMR server is built from', () => {
		expect(
			breakage(
				'Server has getBundler() and getCreateModuleId()',
				'src/metro/hot-socket.ts',
				hasOwnFunctions(Object.getPrototypeOf(server) as Record<string, unknown>, ['getBundler', 'getCreateModuleId']),
			),
		).toBeUndefined()
	})

	it('builds an HMR server whose client handlers work detached from it', () => {
		const { default: HmrServer } = require('metro/private/HmrServer') as {
			default: new (...args: unknown[]) => Record<string, unknown>
		}
		const { getBundler, getCreateModuleId } = server as { getBundler: () => unknown; getCreateModuleId: () => unknown }
		const hmr = new HmrServer(getBundler.call(server), getCreateModuleId.call(server), config)
		const handlers = ['onClientConnect', 'onClientMessage', 'onClientError', 'onClientDisconnect']

		expect(
			breakage(
				`HmrServer's ${handlers.join(', ')} are functions bound to the instance`,
				'src/metro/hot-socket.ts',
				hasOwnFunctions(hmr, handlers),
			),
		).toBeUndefined()
	})

	it("takes websocket upgrades through the HTTP server's upgrade listeners", () => {
		expect(
			breakage(
				'runServer handles websockets in `upgrade` listeners on the HTTP server',
				'src/metro/upgrade-router.ts',
				httpServer.listenerCount('upgrade') > 0,
			),
		).toBeUndefined()
	})
})

describe('Metro sources the library mirrors', () => {
	it('HmrServer answers with update and error messages that carry what the dev client reads', () => {
		const source = packageFile('metro', 'src/HmrServer.js')

		expect(
			breakage(
				'HmrServer sends `update` messages with `isInitialUpdate`, and `error` messages',
				'src/web/dev-client.ts',
				includesAll(source, 'type: "update"', 'isInitialUpdate', 'type: "error"'),
			),
		).toBeUndefined()

		expect(
			breakage(
				'HmrServer takes `register-entrypoints` messages with `entryPoints`',
				'src/metro/hot-socket.ts',
				includesAll(source, '"register-entrypoints"', 'entryPoints'),
			),
		).toBeUndefined()
	})

	it('the module system calls Fast Refresh through the prefixed __ReactRefresh global', () => {
		const source = packageFile('metro-runtime', 'src/polyfills/require.js', require.resolve('metro'))

		expect(
			breakage(
				'metro-runtime reads `global[__METRO_GLOBAL_PREFIX__ + "__ReactRefresh"]`',
				'src/web/dev-client.ts',
				source.includes('__METRO_GLOBAL_PREFIX__ + "__ReactRefresh"'),
			),
		).toBeUndefined()
	})
})

describe('React Native release builds', () => {
	it('Xcode bundles with --bundle-output and the app resources as --assets-dest', () => {
		const script = readFileSync(path.join(REACT_NATIVE_ROOT, 'scripts', 'react-native-xcode.sh'), 'utf8')

		expect(
			breakage(
				'react-native-xcode.sh passes `--assets-dest "$DEST"`, DEST being the app resources folder',
				'src/metro/bundle-command.ts',
				includesAll(
					script,
					'--assets-dest "$DEST"',
					'DEST="$CONFIGURATION_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"',
				),
			),
		).toBeUndefined()
	})

	it('Gradle bundles with --bundle-output into the assets it packages', () => {
		const task = packageFile(
			'@react-native/gradle-plugin',
			'react-native-gradle-plugin/src/main/kotlin/com/facebook/react/tasks/BundleHermesCTask.kt',
			REACT_NATIVE_ROOT,
		)

		expect(
			breakage(
				'BundleHermesCTask passes `--bundle-output` inside the assets folder it packages',
				'src/metro/bundle-command.ts',
				includesAll(
					task,
					'val bundleFile = File(jsBundleDir.get().asFile, bundleAssetFilename)',
					'add("--bundle-output")\n          add(bundleFile.cliPath(rootFile))',
				),
			),
		).toBeUndefined()
	})

	it('the app reports where its bundle came from as SourceCode.scriptURL', () => {
		const spec = readFileSync(
			path.join(REACT_NATIVE_ROOT, 'src', 'private', 'specs_DEPRECATED', 'modules', 'NativeSourceCode.js'),
			'utf8',
		)

		expect(
			breakage(
				"the SourceCode native module's constants include `scriptURL`",
				'src/native/source.ts',
				spec.includes('scriptURL: string'),
			),
		).toBeUndefined()
	})
})
