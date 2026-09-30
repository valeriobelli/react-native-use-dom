import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ConfigT } from 'metro-config';
import Server from 'metro/private/Server';

import { domBundleFileName } from './bundle-file';
import { withoutStartupBanner } from './dev-middleware';
import { renderPage } from './page';
import { DOM_TRANSFORM_OPTION, WEB_ENTRY_PATH } from './transformer';
import { createWebConfig, WEB_PLATFORM } from './web-config';

/**
 * Builds each component's page into `outputDirectory`, replacing whatever an earlier build left.
 *
 * Pages are built for production whatever the native bundle is: an app that loads its bundle from
 * the app has no dev server to reach. They carry no source map and nothing that points outside the
 * app.
 */
export async function buildPages(
	config: ConfigT,
	components: readonly string[],
	outputDirectory: string,
): Promise<void> {
	const server = new Server(withoutStartupBanner(createWebConfig(config)), { watch: false });
	try {
		await server.ready();
		await rm(outputDirectory, { recursive: true, force: true });
		await mkdir(outputDirectory, { recursive: true });
		await Promise.all(components.map((component) => buildPage(server, component, outputDirectory)));
	} finally {
		await server.end();
	}
}

async function buildPage(server: Server, component: string, outputDirectory: string): Promise<void> {
	const page = domBundleFileName(component);
	const script = page.replace(/\.html$/u, '.js');
	const { code } = await server.build({
		...Server.DEFAULT_BUNDLE_OPTIONS,
		entryFile: WEB_ENTRY_PATH,
		customTransformOptions: { [DOM_TRANSFORM_OPTION]: component },
		dev: false,
		minify: true,
		platform: WEB_PLATFORM,
	});
	await Promise.all([
		writeFile(path.join(outputDirectory, script), code),
		writeFile(path.join(outputDirectory, page), renderPage(`<script src="${script}"></script>`)),
	]);
}
