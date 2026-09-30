import path from 'node:path';

import type { BabelTransformerArgs } from 'metro-babel-transformer';

import { DomErrorCode } from '../runtime/errors';
import { calls } from './__fixtures__/echo-transformer';
import { getCacheKey, transform, WEB_ENTRY_PATH } from './transformer';
import type { WebTransformerSettings } from './web-config';
import { WEB_TRANSFORMER_ENV } from './web-config';

const PROJECT_ROOT = path.join(__dirname, '__fixtures__', 'web-project');
const COMPONENT = path.join(PROJECT_ROOT, 'Chart.tsx');
const ECHO_TRANSFORMER = require.resolve('./__fixtures__/echo-transformer');
const REFRESH_PLUGIN = require.resolve('react-refresh/babel');
// React Native's own transformer, as `@react-native/metro-config` resolves it for a project.
const RN_TRANSFORMER = require.resolve('@react-native/metro-babel-transformer', {
	paths: [require.resolve('@react-native/metro-config')],
});

function publishSettings(upstreamTransformerPath = ECHO_TRANSFORMER): void {
	const settings: WebTransformerSettings = { upstreamTransformerPath, allowedRoots: [PROJECT_ROOT] };
	process.env[WEB_TRANSFORMER_ENV] = JSON.stringify(settings);
}

function args(filename: string, options: Partial<BabelTransformerArgs['options']> = {}): BabelTransformerArgs {
	return {
		filename,
		src: 'module.exports = 1;',
		plugins: [],
		options: {
			dev: true,
			enableBabelRuntime: false,
			globalPrefix: '',
			minify: false,
			platform: 'web',
			projectRoot: PROJECT_ROOT,
			publicPath: '/assets',
			...options,
		},
	};
}

function lastCall(): BabelTransformerArgs {
	const call = calls.at(-1);
	if (!call) throw new Error('the upstream transformer was not called');
	return call;
}

const entryFilename = path.relative(PROJECT_ROOT, WEB_ENTRY_PATH);

beforeEach(() => {
	calls.length = 0;
	publishSettings();
});

afterEach(() => {
	delete process.env[WEB_TRANSFORMER_ENV];
});

describe('Fast Refresh instrumentation', () => {
	it('adds react-refresh/babel to application code in development', () => {
		transform(args('Chart.tsx'));

		expect(lastCall().plugins).toEqual([[REFRESH_PLUGIN, { skipEnvCheck: true }]]);
	});

	it.each([
		['a dependency', 'node_modules/chart-lib/index.js', true],
		['a release build', 'Chart.tsx', false],
	])('leaves %s alone', (_, filename, dev) => {
		transform(args(filename, { dev }));

		expect(lastCall().plugins).toEqual([]);
	});

	it("reaches React Native's transformer output", () => {
		publishSettings(RN_TRANSFORMER);

		const result = transform({
			...args('Chart.js'),
			src: 'export default function Chart() { return null; }',
		});

		expect(JSON.stringify(result.ast)).toContain('$RefreshReg$');
	});
});

describe('entry synthesis', () => {
	it('replaces the entry stub with a module that mounts the requested component', () => {
		transform(args(entryFilename, { customTransformOptions: { dom: COMPONENT } }));

		const { src, plugins } = lastCall();
		expect(src).toContain(`import Component from ${JSON.stringify(COMPONENT)};`);
		expect(src).toContain(`import { mountDomComponent } from ${JSON.stringify(require.resolve('../web/mount'))};`);
		expect(src).toContain('mountDomComponent(Component);');
		expect(plugins).toEqual([]);
	});

	it('passes other modules through unchanged', () => {
		transform(args('Chart.tsx', { customTransformOptions: { dom: COMPONENT } }));

		expect(lastCall().src).toBe('module.exports = 1;');
	});

	it.each([
		['outside the project', { customTransformOptions: { dom: '/etc/passwd' } }],
		['escaping the project', { customTransformOptions: { dom: path.join(PROJECT_ROOT, '..', '..', 'web-config.ts') } }],
		['relative', { customTransformOptions: { dom: 'Chart.tsx' } }],
		['missing', {}],
	])('rejects a component path %s', (_, options) => {
		expect(() => transform(args(entryFilename, options))).toThrow(
			expect.objectContaining({ code: DomErrorCode.UnknownDomComponent }),
		);
		expect(calls).toHaveLength(0);
	});
});

describe('getCacheKey', () => {
	it('changes when the upstream transformer changes', () => {
		const withEcho = getCacheKey();
		publishSettings(RN_TRANSFORMER);

		expect(getCacheKey()).not.toBe(withEcho);
	});

	it('fails with a pointer to withDom when the settings were never published', () => {
		delete process.env[WEB_TRANSFORMER_ENV];

		expect(() => getCacheKey()).toThrow(expect.objectContaining({ code: DomErrorCode.MissingMetroConfig }));
	});
});
