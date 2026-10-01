import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ConfigT } from 'metro-config';
import type Server from 'metro/private/Server';

import { domBundleFileName } from './bundle-file';
import { withoutStartupBanner } from './dev-middleware';
import type { Metro } from './host-metro';
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
	metro: Metro,
	config: ConfigT,
	components: readonly string[],
	outputDirectory: string,
): Promise<void> {
	const server = new metro.Server(withoutStartupBanner(createWebConfig(config)), { watch: false });
	try {
		await server.ready();
		await rm(outputDirectory, { recursive: true, force: true });
		await mkdir(outputDirectory, { recursive: true });
		const options = { ...metro.Server.DEFAULT_BUNDLE_OPTIONS };
		await Promise.all(components.map((component) => buildPage(server, options, component, outputDirectory)));
	} finally {
		await server.end();
	}
}

async function buildPage(
	server: Server,
	defaults: typeof Server.DEFAULT_BUNDLE_OPTIONS,
	component: string,
	outputDirectory: string,
): Promise<void> {
	const page = domBundleFileName(component);
	const script = page.replace(/\.html$/u, '.js');
	const { code } = await server.build({
		...defaults,
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
