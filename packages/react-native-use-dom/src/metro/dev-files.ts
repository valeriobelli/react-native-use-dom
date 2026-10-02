import type { ServerResponse } from 'node:http'

import { DEV_BUNDLE_URL_ATTRIBUTE, DEV_ENTRY_PATH, DEV_MOUNT_PATH } from '../runtime/paths'
import { inlineJson, renderPage } from './page'
import { PUBLIC_DIRECTORY, publicDirectory, sendPublicFile } from './public-directory'
import { DOM_TRANSFORM_OPTION } from './transformer'
import { WEB_PLATFORM } from './web-config'

/** How often a page showing a build error checks whether the build works again. */
const RETRY_INTERVAL_MS = 1000

const MOUNT_PREFIX = `/${DEV_MOUNT_PATH}/`

/** Answers `url`, a page request, with the page that loads the component it names. */
export function servePage(url: URL, res: ServerResponse): void {
	const file = url.searchParams.get('file')

	if (file === null || file === '') {
		res.writeHead(400, { 'Content-Type': 'text/plain; charset=UTF-8' })
		res.end('A DOM component page needs the `file` of the component to render.')

		return
	}

	const bundleQuery = new URLSearchParams({
		dev: url.searchParams.get('dev') ?? 'true',
		platform: WEB_PLATFORM,
		[`transform.${DOM_TRANSFORM_OPTION}`]: file,
	})

	res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=UTF-8' })
	res.end(renderDevPage(`${DEV_ENTRY_PATH}?${bundleQuery.toString()}`))
}

/**
 * The page fetches its bundle instead of pointing a script tag at it, because a script tag cannot
 * read the error Metro answers a failed build with. The error is shown in place of the component,
 * and the page reloads itself once the build succeeds again.
 */
function renderDevPage(bundleUrl: string): string {
	return renderPage(`<script>${loaderScript(bundleUrl)}</script>`)
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
				script.setAttribute(${inlineJson(DEV_BUNDLE_URL_ATTRIBUTE)}, bundleUrl);
				script.text = body;
				document.head.appendChild(script);
			});
		})
		.catch(function (error) { showError(String(error)); });
})();
`
}

/**
 * Answers `url`, a request under the mount path, with the file at the same path in the public
 * folder of the project at `projectRoot`, or with a 404 when there is none.
 */
export async function servePublicFile(
	projectRoot: string,
	url: URL,
	res: ServerResponse,
	next: (error?: unknown) => void,
): Promise<void> {
	try {
		if (await sendPublicFile(publicDirectory(projectRoot), url.pathname.slice(MOUNT_PREFIX.length), res)) {
			return
		}

		res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' })
		res.end(`${url.pathname} is not a DOM component route or a file of ${PUBLIC_DIRECTORY}/.`)
	} catch (error) {
		next(error)
	}
}
