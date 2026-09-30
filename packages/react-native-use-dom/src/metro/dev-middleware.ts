import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import type { ConfigT } from 'metro-config';
import Server from 'metro/private/Server';

import { DEV_ENTRY_PATH, DEV_MOUNT_PATH, DEV_PAGE_PATH } from '../runtime/paths';
import { DOM_TRANSFORM_OPTION, WEB_ENTRY_PATH } from './transformer';
import { createWebConfig, WEB_PLATFORM } from './web-config';

/** A connect-style middleware, the shape `server.enhanceMiddleware` receives and returns. */
export type Middleware = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void;

/** The development routes of DOM components, and the web bundler behind them. */
export interface DomDevServer {
	/** Serves `/_dom` requests and passes every other request to `next`. */
	middleware: Middleware;
	/** The web bundler, started by the first bundle request. */
	getWebServer(): Promise<Server>;
	/** Stops the web bundler if it was started. */
	close(): Promise<void>;
}

interface WebBundler {
	server: Server;
	/** The `bundleEntry` that makes Metro build the generated entry module. */
	bundleEntry: string;
}

const MOUNT_PREFIX = `/${DEV_MOUNT_PATH}/`;

/** How often a page showing a build error checks whether the build works again. */
const RETRY_INTERVAL_MS = 1000;

/**
 * Creates the development routes DOM components load from, on the React Native dev server.
 *
 * `GET /_dom/index.html?file=<component>` answers with the page the native view loads, which in
 * turn loads `/_dom/entry.bundle`: the component's bundle, built by a second Metro instance
 * configured for the web from `config`. That instance starts on the first bundle request, so apps
 * that render no DOM component never pay for it.
 */
export function createDomDevServer(config: ConfigT): DomDevServer {
	let bundler: Promise<WebBundler> | null = null;

	const getBundler = (): Promise<WebBundler> => {
		bundler ??= startWebBundler(config);
		return bundler;
	};

	const middleware: Middleware = (req, res, next) => {
		const url = new URL(req.url ?? '/', 'http://localhost');

		if (!url.pathname.startsWith(MOUNT_PREFIX)) {
			next();
			return;
		}
		if (url.pathname === DEV_PAGE_PATH) {
			servePage(url, res);
			return;
		}
		if (url.pathname === DEV_ENTRY_PATH) {
			void forwardBundleRequest(getBundler, url, req, res, next);
			return;
		}
		res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
		res.end(`${url.pathname} is not a DOM component route.`);
	};

	return {
		middleware,
		getWebServer: async () => (await getBundler()).server,
		close: async () => {
			const started = bundler;
			bundler = null;
			await (await started)?.server.end();
		},
	};
}

async function forwardBundleRequest(
	getBundler: () => Promise<WebBundler>,
	url: URL,
	...[req, res, next]: Parameters<Middleware>
): Promise<void> {
	let started: WebBundler;
	try {
		started = await getBundler();
	} catch (error) {
		next(error);
		return;
	}
	req.url = toWebBundleUrl(url, started.bundleEntry);
	started.server.processRequest(req, res, next);
}

async function startWebBundler(config: ConfigT): Promise<WebBundler> {
	const webConfig = createWebConfig(config);
	// Metro's own `runMetro` also announces the server to the reporter, which would print a second
	// start-up banner in the terminal of the dev server the developer already started.
	const server = new Server(webConfig, { watch: true });
	await server.ready();
	return { server, bundleEntry: entryBundlePath(webConfig) };
}

/**
 * The entry file lives in this package, which can sit outside the project (a workspace, a link),
 * so it is addressed through the watch folder that holds it, the way Metro addresses such files
 * itself. The web config always watches the package.
 */
function entryBundlePath(webConfig: ConfigT): string {
	const bundlePath = WEB_ENTRY_PATH.replace(/\.[^./\\]+$/u, '.bundle');
	const index = webConfig.watchFolders.findIndex((folder) => !path.relative(folder, bundlePath).startsWith('..'));
	const root = webConfig.watchFolders[index] ?? webConfig.projectRoot;
	const relative = path.relative(root, bundlePath).split(path.sep).join('/');
	return index === -1 ? relative : `[metro-watchFolders]/${index}/${relative}`;
}

/** Source maps are inlined: the page has no route to fetch a separate one from. */
function toWebBundleUrl(url: URL, bundleEntry: string): string {
	const query = new URLSearchParams(url.search);
	query.set('bundleEntry', bundleEntry);
	query.set('platform', WEB_PLATFORM);
	query.set('inlineSourceMap', 'true');
	return `${url.pathname}?${query.toString()}`;
}

function servePage(url: URL, res: ServerResponse): void {
	const file = url.searchParams.get('file');
	if (file === null || file === '') {
		res.writeHead(400, { 'Content-Type': 'text/plain; charset=UTF-8' });
		res.end('A DOM component page needs the `file` of the component to render.');
		return;
	}

	const bundleQuery = new URLSearchParams({
		platform: WEB_PLATFORM,
		dev: url.searchParams.get('dev') ?? 'true',
		[`transform.${DOM_TRANSFORM_OPTION}`]: file,
	});
	res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' });
	res.end(renderPage(`${DEV_ENTRY_PATH}?${bundleQuery.toString()}`));
}

/**
 * The page fetches its bundle instead of pointing a script tag at it, because a script tag cannot
 * read the error Metro answers a failed build with. The error is shown in place of the component,
 * and the page reloads itself once the build succeeds again.
 */
function renderPage(bundleUrl: string): string {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head>
<body>
<div id="root"></div>
<script>${loaderScript(bundleUrl)}</script>
</body>
</html>
`;
}

/** Runs in the WebView, as written: it is not built by Metro, so it sticks to what every engine runs. */
function loaderScript(bundleUrl: string): string {
	return `
(function () {
	var bundleUrl = ${inlineJson(bundleUrl)};
	function describe(body) {
		try {
			var error = JSON.parse(body);
			var locations = (error.errors || [])
				.filter(function (e) { return e.filename; })
				.map(function (e) { return e.filename + (e.lineNumber != null ? ':' + e.lineNumber : ''); });
			return [error.type, locations.join('\\n'), error.message].filter(Boolean).join('\\n\\n');
		} catch (_) {
			return body;
		}
	}
	function showError(text) {
		var pre = document.createElement('pre');
		pre.id = 'use-dom-build-error';
		pre.style.cssText = 'margin:0;padding:16px;white-space:pre-wrap;font:12px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:#b3261e;min-height:100vh;box-sizing:border-box';
		pre.textContent = text;
		document.body.replaceChildren(pre);
		setTimeout(function retry() {
			fetch(bundleUrl, { cache: 'no-store' })
				.then(function (res) { res.ok ? location.reload() : setTimeout(retry, ${RETRY_INTERVAL_MS}); })
				.catch(function () { setTimeout(retry, ${RETRY_INTERVAL_MS}); });
		}, ${RETRY_INTERVAL_MS});
	}
	fetch(bundleUrl, { cache: 'no-store' })
		.then(function (res) {
			return res.text().then(function (body) {
				if (!res.ok) return showError(describe(body));
				var script = document.createElement('script');
				script.text = body;
				document.head.appendChild(script);
			});
		})
		.catch(function (error) { showError(String(error)); });
})();
`;
}

/** JSON is valid JavaScript, but `</script>` inside it would end the script element early. */
function inlineJson(value: string): string {
	return JSON.stringify(value).replaceAll('<', '\\u003c');
}
