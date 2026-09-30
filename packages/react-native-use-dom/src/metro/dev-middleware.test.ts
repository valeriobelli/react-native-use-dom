import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { getDefaultConfig } from '@react-native/metro-config';
import { JSDOM, VirtualConsole } from 'jsdom';
import type { ConfigT } from 'metro-config';
import { mergeConfig } from 'metro-config';

import { DEV_ENTRY_PATH, DEV_PAGE_PATH } from '../runtime/paths';
import { createDomDevServer } from './dev-middleware';
import { WEB_TRANSFORMER_ENV } from './web-config';

jest.setTimeout(120_000);

// React Native's preset, as an app's babel.config.js gets it.
const RN_BABEL_PRESET = require.resolve('@react-native/babel-preset', {
	paths: [require.resolve('@react-native/metro-config')],
});

// The package's dependencies are links into the workspace's store, which Metro only follows into
// folders it watches: the fixture is set up the way a workspace app is.
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const HELLO = "export default function Hello(props) { return 'hello ' + props.name; }\n";
const BROKEN = 'export default function Hello( {\n';

/** A component with state only the page holds: what an input's user typed. */
function withInput(greeting: string): string {
	return `export default function Hello(props) {\n\treturn <label>${greeting} {props.name}<input id="typed" /></label>;\n}\n`;
}
const PASSED_THROUGH = 'passed through';

interface ReporterEvent {
	type: string;
}

let projectRoot: string;
let component: string;
let reported: ReporterEvent[];
let dev: ReturnType<typeof createDomDevServer>;
let httpServer: http.Server;
let origin: string;

function writeComponent(source: string): void {
	writeFileSync(component, source);
}

/** The fixture's config as Metro loads it, which puts the project root first among the watch folders. */
function projectConfig(): ConfigT {
	return mergeConfig(getDefaultConfig(projectRoot), {
		cacheStores: [],
		maxWorkers: 1,
		reporter: { update: (event: ReporterEvent) => reported.push(event) },
		resolver: { useWatchman: false },
		watchFolders: [projectRoot, WORKSPACE_ROOT],
	});
}

function pageUrl(file: string): string {
	const query = new URLSearchParams({ file, platform: 'web', dev: 'true' });
	return `${origin}${DEV_PAGE_PATH}?${query.toString()}`;
}

interface Page {
	dom: JSDOM;
	/** Whether the page asked to be reloaded, which jsdom reports instead of navigating. */
	reloaded(): boolean;
}

/** Loads the page the way the native view does: the native side injects props before any script runs. */
async function openPage(url: string): Promise<Page> {
	const html = await (await fetch(url)).text();
	let reloaded = false;
	const virtualConsole = new VirtualConsole();
	virtualConsole.on('jsdomError', (error) => {
		if (error.message.includes('navigation')) reloaded = true;
		else throw error;
	});
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
			});
		},
	});
	return { dom, reloaded: () => reloaded };
}

function fetchBundle(): Promise<Response> {
	const query = new URLSearchParams({ platform: 'web', dev: 'true', 'transform.dom': component });
	return fetch(`${origin}${DEV_ENTRY_PATH}?${query.toString()}`);
}

type Probe<T> = () => T | Promise<T>;

/** Resolves with the first truthy value `read` returns. */
async function waitFor<T>(what: string, read: Probe<T>, deadline = Date.now() + 60_000): Promise<NonNullable<T>> {
	const value = await read();
	if (value) return value;
	if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});
	return waitFor(what, read, deadline);
}

/** Stands in for the rest of the dev server: whatever the DOM routes pass on ends here. */
function nextMiddleware(res: http.ServerResponse): (error?: unknown) => void {
	return (error) => {
		res.writeHead(error ? 500 : 200);
		res.end(error ? String(error) : PASSED_THROUGH);
	};
}

beforeAll(async () => {
	projectRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'use-dom-dev-')));
	component = path.join(projectRoot, 'Hello.js');
	writeFileSync(path.join(projectRoot, 'package.json'), '{ "name": "dev-fixture" }\n');
	writeFileSync(
		path.join(projectRoot, 'babel.config.js'),
		`module.exports = { presets: [${JSON.stringify(RN_BABEL_PRESET)}] };\n`,
	);
	writeComponent(HELLO);
	// Components with JSX import React's runtime, which an app has installed.
	mkdirSync(path.join(projectRoot, 'node_modules'));
	symlinkSync(path.dirname(require.resolve('react/package.json')), path.join(projectRoot, 'node_modules', 'react'));

	reported = [];
	dev = createDomDevServer(projectConfig());
	httpServer = http.createServer((req, res) => {
		dev.middleware(req, res, nextMiddleware(res));
	});
	await new Promise<void>((resolve) => {
		httpServer.listen(0, '127.0.0.1', resolve);
	});
	origin = `http://127.0.0.1:${(httpServer.address() as { port: number }).port}`;
});

afterAll(async () => {
	await new Promise((resolve) => {
		httpServer.close(resolve);
	});
	await dev.close();
	rmSync(projectRoot, { recursive: true, force: true });
	delete process.env[WEB_TRANSFORMER_ENV];
});

it('passes requests outside /_dom to the next middleware untouched', async () => {
	const response = await fetch(`${origin}/index.bundle?platform=ios`);

	expect(await response.text()).toBe(PASSED_THROUGH);
});

it('answers unknown /_dom routes itself', async () => {
	expect((await fetch(`${origin}/_dom/elsewhere.js`)).status).toBe(404);
});

it('refuses a page without a component', async () => {
	expect((await fetch(`${origin}${DEV_PAGE_PATH}`)).status).toBe(400);
});

it('serves a page that renders the component with the injected props', async () => {
	const { dom } = await openPage(pageUrl(component));

	const text = await waitFor('the component', () => dom.window.document.querySelector('#root')?.textContent);
	expect(text).toBe('hello dom');
	dom.window.close();
});

it('builds the bundle for the web, with an inline source map', async () => {
	const bundle = await (await fetchBundle()).text();

	expect(bundle).toContain('mountDomComponent');
	expect(bundle).not.toContain('react-native/Libraries');
	expect(bundle).toContain('//# sourceMappingURL=data:application/json');
});

it('leaves the start-up banner to the dev server the developer started', () => {
	// By now the pages and bundles above have started the web bundler.
	expect(reported.map((event) => event.type)).not.toContain('dep_graph_loading');
});

it('shows a build error with its location, reports it, and reloads once it is fixed', async () => {
	writeComponent(BROKEN);
	reported.length = 0;
	// Metro sees the edit through its file watcher, a moment after it is written.
	await waitFor('the watcher to see the edit', async () => !(await fetchBundle()).ok);
	const { dom, reloaded } = await openPage(pageUrl(component));

	try {
		const shown = await waitFor(
			'the build error',
			() => dom.window.document.querySelector('#use-dom-build-error')?.textContent,
		);
		expect(shown).toContain(`${component}:`);
		expect(reported.map((event) => event.type)).toContain('bundling_error');

		writeComponent(HELLO);
		await waitFor('the reload', reloaded);
	} finally {
		writeComponent(HELLO);
		dom.window.close();
	}
});

/**
 * Opens the page on a component greeting with `greeting`, once its bundle has it: Metro sees edits a
 * moment after they are written. Each test greets differently, so none opens on a previous one's.
 */
async function openWith(greeting: string): Promise<Page> {
	writeComponent(withInput(greeting));
	await waitFor('the watcher to see the edit', async () => (await (await fetchBundle()).text()).includes(greeting));
	const page = await openPage(pageUrl(component));
	await waitFor('the component', () => page.dom.window.document.querySelector('#typed'));
	// The page registers for updates as it starts; one sent before it did would never arrive.
	await new Promise((resolve) => {
		setTimeout(resolve, 500);
	});
	return page;
}

function textOf(page: Page): string {
	return page.dom.window.document.querySelector('#root')?.textContent ?? '';
}

describe('hot updates', () => {
	afterEach(() => {
		writeComponent(HELLO);
	});

	it('updates the component in place, keeping what was typed into it', async () => {
		const page = await openWith('hallo');
		const input = await waitFor('the input', () => page.dom.window.document.querySelector<HTMLInputElement>('#typed'));
		input.value = 'typed before the edit';

		try {
			writeComponent(withInput('bonjour'));
			await waitFor('the update', () => textOf(page).includes('bonjour dom'));

			expect(page.dom.window.document.querySelector<HTMLInputElement>('#typed')).toBe(input);
			expect(input.value).toBe('typed before the edit');
			expect(page.reloaded()).toBe(false);
		} finally {
			page.dom.window.close();
		}
	});

	it('reloads the page for an edit that cannot be applied in place', async () => {
		const page = await openWith('hola');

		try {
			// A module that exports more than components is no boundary Fast Refresh can stop at.
			writeComponent(`${withInput('hola')}export const notAComponent = 1;\n`);
			await waitFor('the reload', page.reloaded);

			expect(page.reloaded()).toBe(true);
		} finally {
			page.dom.window.close();
		}
	});

	it('shows a build error over the component, and takes it away once the edit builds', async () => {
		const page = await openWith('ciao');
		const { document } = page.dom.window;

		try {
			writeComponent(BROKEN);
			const shown = await waitFor('the build error', () => document.querySelector('#use-dom-hot-error')?.textContent);
			expect(shown).toContain(component);
			// The component is still underneath, for when the edit is fixed.
			expect(document.querySelector('#typed')).not.toBeNull();

			writeComponent(withInput('fixed'));
			await waitFor('the update', () => textOf(page).includes('fixed dom'));
			expect(document.querySelector('#use-dom-hot-error')).toBeNull();
			expect(page.reloaded()).toBe(false);
		} finally {
			page.dom.window.close();
		}
	});
});
