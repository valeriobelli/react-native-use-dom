import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDefaultConfig } from '@react-native/metro-config';
import { runBuild } from 'metro';
import type { ConfigT } from 'metro-config';
import { mergeConfig } from 'metro-config';

import { OFFLINE_BUNDLE_DIR } from '../runtime/paths';
import { domBundleFileName } from './bundle-file';
import { WEB_TRANSFORMER_ENV } from './web-config';
import { withDom } from './with-dom';

jest.setTimeout(180_000);

// The package's dependencies are links into the workspace's store, which Metro only follows into
// folders it watches: the fixture is set up the way a workspace app is.
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const RN_BABEL_PRESET = require.resolve('@react-native/babel-preset', {
	paths: [require.resolve('@react-native/metro-config')],
});
const COMPONENT = "'use dom';\nexport default function Hello(props) { return <p>released {props.name}</p>; }\n";

describe('a release build', () => {
	let projectRoot: string;
	let argv: string[];

	beforeAll(() => {
		projectRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'use-dom-release-')));
		writeFileSync(path.join(projectRoot, 'package.json'), '{ "name": "release-fixture" }\n');
		writeFileSync(
			path.join(projectRoot, 'babel.config.js'),
			`module.exports = { presets: [${JSON.stringify(RN_BABEL_PRESET)}] };\n`,
		);
		writeFileSync(path.join(projectRoot, 'Hello.js'), COMPONENT);
		writeFileSync(path.join(projectRoot, 'Unused.js'), COMPONENT);
		writeFileSync(path.join(projectRoot, 'index.js'), "global.hello = require('./Hello');\n");
		mkdirSync(path.join(projectRoot, 'node_modules'));
		symlinkSync(path.dirname(require.resolve('react/package.json')), path.join(projectRoot, 'node_modules', 'react'));
		argv = process.argv;
	});

	afterAll(() => {
		process.argv = argv;
		rmSync(projectRoot, { recursive: true, force: true });
		delete process.env[WEB_TRANSFORMER_ENV];
	});

	/** Bundles the fixture the way `react-native bundle` does, with the arguments Gradle passes. */
	async function bundleForAndroid(): Promise<string> {
		const bundleOutput = path.join(projectRoot, 'build', 'assets', 'index.android.bundle');
		process.argv = ['node', 'cli.js', 'bundle', '--bundle-output', bundleOutput, '--assets-dest', 'build/res'];
		const config = (await withDom(
			mergeConfig(getDefaultConfig(projectRoot), {
				cacheStores: [],
				maxWorkers: 1,
				reporter: { update: () => {} },
				resolver: { useWatchman: false },
				watchFolders: [projectRoot, WORKSPACE_ROOT],
			}),
		)) as ConfigT;
		mkdirSync(path.dirname(bundleOutput), { recursive: true });
		await runBuild(config, {
			entry: './index.js',
			platform: 'android',
			dev: false,
			minify: false,
			bundleOut: bundleOutput,
		});
		return path.join(path.dirname(bundleOutput), OFFLINE_BUNDLE_DIR);
	}

	it('embeds a page for each DOM component the app renders, and none for the rest', async () => {
		const pages = await bundleForAndroid();
		const page = domBundleFileName(path.join(projectRoot, 'Hello.js'));
		const script = page.replace(/\.html$/u, '.js');

		expect(readdirSync(pages).sort()).toEqual([page, script].sort());
		expect(readFileSync(path.join(pages, page), 'utf8')).toContain(`<script src="${script}"></script>`);

		const code = readFileSync(path.join(pages, script), 'utf8');
		expect(code).toContain('released');
		expect(code).not.toContain('sourceMappingURL');
		expect(code).not.toContain('/_dom/');
		expect(existsSync(path.join(pages, domBundleFileName(path.join(projectRoot, 'Unused.js'))))).toBe(false);
	});

	it('replaces the pages an earlier build left', async () => {
		const pages = await bundleForAndroid();
		writeFileSync(path.join(pages, 'stale.html'), '');

		await bundleForAndroid();

		expect(existsSync(path.join(pages, 'stale.html'))).toBe(false);
	});
});
