import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { getDefaultConfig } from '@react-native/metro-config'
import { JSDOM, VirtualConsole } from 'jsdom'

import { DEV_ENTRY_PATH, DEV_PAGE_PATH } from '../../runtime/paths'
import { createDomDevServer } from '../dev-middleware'
import { hostMetro } from '../host-metro'
import { WEB_TRANSFORMER_ENV } from '../web-config'

// React Native's preset, as an app's babel.config.js gets it.
const RN_BABEL_PRESET = require.resolve('@react-native/babel-preset', {
	paths: [require.resolve('@react-native/metro-config')],
})

// The package's dependencies are links into the workspace's store, which Metro only follows into
// folders it watches: the fixture is set up the way a workspace app is.
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..')

export const HELLO = "export default function Hello(props) { return 'hello ' + props.name; }\n"
export const BROKEN = 'export default function Hello( {\n'
export const PASSED_THROUGH = 'passed through'

/** A component with state only the page holds: what an input's user typed. */
export function withInput(greeting: string): string {
	return `export default function Hello(props) {\n\treturn <label>${greeting} {props.name}<input id="typed" /></label>;\n}\n`
}

/** The stylesheet the fixture's component can import, as `./styles.css`. */
export const STYLESHEET = 'styles.css'

/** {@link withInput}, styled by {@link STYLESHEET}. */
export function withStylesheet(greeting: string): string {
	return `import './${STYLESHEET}';\n${withInput(greeting)}`
}

/** A file of the fixture's `public` folder, and what it holds. */
export const PUBLIC_IMAGE = 'logo.svg'
export const PUBLIC_IMAGE_SOURCE = '<svg xmlns="http://www.w3.org/2000/svg"/>'

export interface ReporterEvent {
	type: string
}

export interface Page {
	dom: JSDOM
	/** Whether the page asked to be reloaded, which jsdom reports instead of navigating. */
	reloaded(): boolean
}

/** A project with one component, served by the DOM routes on a server of its own. */
export interface DevFixture {
	/** The component's file. */
	component: string
	origin: string
	/** What Metro reported, in order. */
	reported: ReporterEvent[]
	writeComponent(source: string): void
	writeStylesheet(css: string): void
	pageUrl(): string
	fetchBundle(): Promise<Response>
	/** Loads the page the way the native view does: the native side injects props before any script runs. */
	openPage(): Promise<Page>
	/** Cuts every connection to the server, websockets included, the way a dev server that stops does. */
	dropConnections(): void
	/** Closes the HTTP server the way a dev server's CLI does: through `close`, and the connections it tracks. */
	closeHttpServer(): Promise<void>
	close(): Promise<void>
}

type Probe<T> = () => T | Promise<T>

/** Resolves with the first truthy value `read` returns. */
export async function waitFor<T>(
	what: string,
	read: Probe<T>,
	deadline = Date.now() + 60_000,
): Promise<NonNullable<T>> {
	const value = await read()
	if (value) return value
	if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
	await new Promise((resolve) => {
		setTimeout(resolve, 50)
	})
	return waitFor(what, read, deadline)
}

/** Stands in for the rest of the dev server: whatever the DOM routes pass on ends here. */
function nextMiddleware(res: http.ServerResponse): (error?: unknown) => void {
	return (error) => {
		res.writeHead(error ? 500 : 200)
		res.end(error ? String(error) : PASSED_THROUGH)
	}
}

function createProject(): string {
	const projectRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'use-dom-dev-')))
	writeFileSync(path.join(projectRoot, 'package.json'), '{ "name": "dev-fixture" }\n')
	writeFileSync(
		path.join(projectRoot, 'babel.config.js'),
		`module.exports = { presets: [${JSON.stringify(RN_BABEL_PRESET)}] };\n`,
	)
	writeFileSync(path.join(projectRoot, 'Hello.js'), HELLO)
	mkdirSync(path.join(projectRoot, 'public', 'fonts'), { recursive: true })
	writeFileSync(path.join(projectRoot, 'public', PUBLIC_IMAGE), PUBLIC_IMAGE_SOURCE)
	writeFileSync(path.join(projectRoot, 'public', 'fonts', 'Inter.woff2'), 'wOF2')
	// Components with JSX import React's runtime, which an app has installed.
	mkdirSync(path.join(projectRoot, 'node_modules'))
	symlinkSync(path.dirname(require.resolve('react/package.json')), path.join(projectRoot, 'node_modules', 'react'))
	return projectRoot
}

/** The fixture's config as Metro loads it, which puts the project root first among the watch folders. */
function projectConfig(projectRoot: string, reported: ReporterEvent[]): Parameters<typeof createDomDevServer>[0] {
	return hostMetro().mergeConfig(getDefaultConfig(projectRoot), {
		cacheStores: [],
		maxWorkers: 1,
		reporter: { update: (event: ReporterEvent) => reported.push(event) },
		resolver: { useWatchman: false },
		watchFolders: [projectRoot, WORKSPACE_ROOT],
	})
}

async function loadPage(url: string): Promise<Page> {
	const html = await (await fetch(url)).text()
	let reloaded = false
	const virtualConsole = new VirtualConsole()
	virtualConsole.on('jsdomError', (error) => {
		if (error.message.includes('navigation')) reloaded = true
		else throw error
	})
	const dom = new JSDOM(html, {
		url,
		runScripts: 'dangerously',
		virtualConsole,
		beforeParse(window) {
			Object.assign(window, {
				fetch: (input: string, init?: RequestInit) => fetch(new URL(input, url), init),
				ReactNativeWebView: {
					postMessage: () => {},
					injectedObjectJson: () => JSON.stringify({ instanceId: 'test', props: { name: 'dom' }, actions: [] }),
				},
			})
		},
	})
	return { dom, reloaded: () => reloaded }
}

/** An HTTP server on a free local port, with the connections it has open. */
async function listen(
	handler: http.RequestListener,
): Promise<{ httpServer: http.Server; connections: Set<http.IncomingMessage['socket']> }> {
	const httpServer = http.createServer(handler)
	const connections = new Set<http.IncomingMessage['socket']>()
	httpServer.on('connection', (socket) => {
		connections.add(socket)
		socket.on('close', () => connections.delete(socket))
	})
	await new Promise<void>((resolve) => {
		httpServer.listen(0, '127.0.0.1', resolve)
	})
	return { httpServer, connections }
}

export async function startDevFixture(): Promise<DevFixture> {
	const projectRoot = createProject()
	const component = path.join(projectRoot, 'Hello.js')
	const reported: ReporterEvent[] = []
	const dev = createDomDevServer(projectConfig(projectRoot, reported), hostMetro())
	const { httpServer, connections } = await listen((req, res) => {
		dev.middleware(req, res, nextMiddleware(res))
	})
	const origin = `http://127.0.0.1:${(httpServer.address() as { port: number }).port}`

	const pageUrl = (): string => {
		const query = new URLSearchParams({ file: component, platform: 'web', dev: 'true' })
		return `${origin}${DEV_PAGE_PATH}?${query.toString()}`
	}

	return {
		component,
		origin,
		reported,
		writeComponent: (source) => {
			writeFileSync(component, source)
		},
		writeStylesheet: (css) => {
			writeFileSync(path.join(projectRoot, STYLESHEET), css)
		},
		pageUrl,
		fetchBundle: () => {
			const query = new URLSearchParams({ platform: 'web', dev: 'true', 'transform.dom': component })
			return fetch(`${origin}${DEV_ENTRY_PATH}?${query.toString()}`)
		},
		openPage: () => loadPage(pageUrl()),
		dropConnections: () => {
			for (const socket of connections) socket.destroy()
		},
		closeHttpServer: () =>
			new Promise<void>((resolve, reject) => {
				httpServer.close((error) => (error ? reject(error) : resolve()))
				httpServer.closeAllConnections()
			}),
		close: async () => {
			await new Promise((resolve) => {
				httpServer.close(resolve)
			})
			await dev.close()
			rmSync(projectRoot, { recursive: true, force: true })
			delete process.env[WEB_TRANSFORMER_ENV]
		},
	}
}
