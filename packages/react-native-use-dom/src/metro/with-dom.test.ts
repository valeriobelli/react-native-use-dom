import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import type http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { getDefaultConfig } from '@react-native/metro-config'
import { runServer } from 'metro'
import type { ConfigT, InputConfigT } from 'metro-config'
import { mergeConfig } from 'metro-config'

import { DEV_ENTRY_PATH, DEV_HOT_PATH, DEV_PAGE_PATH } from '../runtime/paths'
import { WEB_TRANSFORMER_ENV } from './web-config'
import { withDom } from './with-dom'

jest.setTimeout(120_000)

// The package's dependencies are links into the workspace's store, which Metro only follows into
// folders it watches: the fixture is set up the way a workspace app is.
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const RN_BABEL_PRESET = require.resolve('@react-native/babel-preset', {
	paths: [require.resolve('@react-native/metro-config')],
})
const ENHANCED_HEADER = 'x-enhanced-by-project'

let projectRoot: string

/** The fixture's config as Metro loads it, which puts the project root first among the watch folders. */
function projectConfig(overrides: InputConfigT = {}): ConfigT {
	return mergeConfig(
		getDefaultConfig(projectRoot),
		{
			cacheStores: [],
			// Metro keeps its file map in the OS temp folder across runs, which a stale copy can break.
			resetCache: true,
			maxWorkers: 1,
			reporter: { update: () => {} },
			resolver: { useWatchman: false },
			server: { port: 0 },
			watchFolders: [projectRoot, WORKSPACE_ROOT],
		},
		overrides,
	)
}

/** A project's own middleware, the kind apps add through `enhanceMiddleware`. */
const projectEnhancer: NonNullable<ConfigT['server']['enhanceMiddleware']> = (middleware) => {
	const enhanced = (req: http.IncomingMessage, res: http.ServerResponse, next: (error?: unknown) => void): void => {
		res.setHeader(ENHANCED_HEADER, 'yes')
		middleware(req, res, next)
	}
	return enhanced
}

async function serve(config: ConfigT): Promise<{ origin: string; close: () => Promise<void> }> {
	const { httpServer } = await runServer(config, { host: '127.0.0.1' })
	const { port } = (httpServer as http.Server).address() as { port: number }
	return {
		origin: `http://127.0.0.1:${port}`,
		close: () =>
			new Promise((resolve) => {
				httpServer.close(() => resolve())
				;(httpServer as http.Server).closeAllConnections()
			}),
	}
}

beforeAll(() => {
	projectRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'use-dom-with-')))
	writeFileSync(path.join(projectRoot, 'package.json'), '{ "name": "with-dom-fixture" }\n')
	writeFileSync(
		path.join(projectRoot, 'babel.config.js'),
		`module.exports = { presets: [${JSON.stringify(RN_BABEL_PRESET)}] };\n`,
	)
	writeFileSync(path.join(projectRoot, 'index.js'), "module.exports = 'native entry';\n")
	writeFileSync(path.join(projectRoot, 'Hello.js'), 'export default function Hello() { return null; }\n')
})

afterAll(() => {
	rmSync(projectRoot, { recursive: true, force: true })
	delete process.env[WEB_TRANSFORMER_ENV]
})

describe('withDom', () => {
	it.each([
		['an object', () => projectConfig()],
		['a Promise', () => Promise.resolve(projectConfig())],
	])('accepts %s and keeps the rest of the config', async (_, make) => {
		const config = (await withDom(make())) as ConfigT

		expect(config.resolver.useWatchman).toBe(false)
		expect(config.watchFolders).toEqual([projectRoot, WORKSPACE_ROOT])
		expect(config.server.enhanceMiddleware).toEqual(expect.any(Function))
	})

	it('accepts a function config and calls it with the defaults', async () => {
		const defaults = projectConfig()
		const make = jest.fn((received: ConfigT) => ({ ...received, maxWorkers: 3 }))

		const config = await withDom(make)(defaults)

		expect(make).toHaveBeenCalledWith(defaults)
		expect(config.maxWorkers).toBe(3)
		expect(config.server?.enhanceMiddleware).toEqual(expect.any(Function))
	})

	it('builds native bundles and serves DOM components from the same dev server', async () => {
		const config = (await withDom(projectConfig({ server: { enhanceMiddleware: projectEnhancer } }))) as ConfigT
		const server = await serve(config)

		try {
			const native = await fetch(`${server.origin}/index.bundle?platform=ios&dev=true`)
			expect(native.status).toBe(200)
			expect(await native.text()).toContain('native entry')
			// The project's own middleware still runs for everything that is not a DOM component.
			expect(native.headers.get(ENHANCED_HEADER)).toBe('yes')

			const file = path.join(projectRoot, 'Hello.js')
			const page = await fetch(`${server.origin}${DEV_PAGE_PATH}?${new URLSearchParams({ file }).toString()}`)
			expect(await page.text()).toContain(DEV_ENTRY_PATH)

			const query = new URLSearchParams({ platform: 'web', dev: 'true', 'transform.dom': file })
			const dom = await fetch(`${server.origin}${DEV_ENTRY_PATH}?${query.toString()}`)
			expect(dom.status).toBe(200)
			expect(await dom.text()).toContain('mountDomComponent')
		} finally {
			await server.close()
		}
	})

	it('serves hot updates for DOM components on their own socket, next to the native ones', async () => {
		const server = await serve((await withDom(projectConfig())) as ConfigT)
		const socketOrigin = server.origin.replace(/^http/u, 'ws')

		try {
			const file = path.join(projectRoot, 'Hello.js')
			await fetch(`${server.origin}${DEV_PAGE_PATH}?${new URLSearchParams({ file }).toString()}`)
			const domBundle = `${DEV_ENTRY_PATH}?${new URLSearchParams({ platform: 'web', dev: 'true', 'transform.dom': file }).toString()}`
			await (await fetch(`${server.origin}${domBundle}`)).text()
			const nativeBundle = '/index.bundle?platform=ios&dev=true'
			await (await fetch(`${server.origin}${nativeBundle}`)).text()

			await expect(registerBundle(`${socketOrigin}${DEV_HOT_PATH}`, `${server.origin}${domBundle}`)).resolves.toBe(
				'bundle-registered',
			)
			await expect(registerBundle(`${socketOrigin}/hot`, `${server.origin}${nativeBundle}`)).resolves.toBe(
				'bundle-registered',
			)
			// The DOM socket only knows DOM bundles, which is what keeps the two apart.
			await expect(registerBundle(`${socketOrigin}${DEV_HOT_PATH}`, `${server.origin}${nativeBundle}`)).resolves.toBe(
				'error',
			)
		} finally {
			await server.close()
		}
	})
})

/** Registers a bundle with an HMR socket the way Metro's client does, and answers how the server replied. */
function registerBundle(socketUrl: string, bundleUrl: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(socketUrl)
		socket.addEventListener('open', () => {
			socket.send(JSON.stringify({ type: 'register-entrypoints', entryPoints: [bundleUrl] }))
		})
		socket.addEventListener('message', (event: MessageEvent<string>) => {
			const { type } = JSON.parse(event.data) as { type: string }
			if (type !== 'bundle-registered' && type !== 'error') return
			socket.close()
			resolve(type)
		})
		socket.addEventListener('error', () => reject(new Error(`${socketUrl} refused the connection.`)))
	})
}
