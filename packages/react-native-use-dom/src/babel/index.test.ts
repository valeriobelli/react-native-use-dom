import { transformSync } from '@babel/core'

import { domBundleFileName } from '../metro/bundle-file'
import type { DomError } from '../runtime/errors'
import { DomErrorCode } from '../runtime/errors'
import useDomPlugin from './index'
import type { UseDomMetadata, UseDomPluginOptions } from './index'

function compile(source: string, options: UseDomPluginOptions = {}) {
	const result = transformSync(source, {
		babelrc: false,
		configFile: false,
		filename: '/app/src/Chart.tsx',
		plugins: [[useDomPlugin, options]],
		presets: [['@babel/preset-typescript', { allExtensions: true, isTSX: true }]],
	})

	if (!result?.code) {
		throw new Error('transform produced no code')
	}

	return {
		code: result.code,
		metadata: (result.metadata as { useDom?: UseDomMetadata }).useDom,
	}
}

function capture(run: () => unknown): DomError {
	try {
		run()
	} catch (error) {
		return error as DomError
	}

	throw new Error('expected the transform to throw, but it returned')
}

const COMPONENT = `'use dom';
export default function Chart({ points }: { points: number[] }) {
  return <svg>{points.length}</svg>;
}
`

describe('on a native platform', () => {
	it('replaces the module with a proxy that points back at the file', () => {
		const { code } = compile(COMPONENT, { platform: 'ios' })

		expect(code).toContain('createDomComponentProxy')
		expect(code).toContain('react-native-use-dom')
		expect(code).toContain('/app/src/Chart.tsx')
	})

	it('names the page a release build embeds for the file', () => {
		const { code } = compile(COMPONENT, { platform: 'ios' })

		expect(code).toContain(`bundleFile: "${domBundleFileName('/app/src/Chart.tsx')}"`)
	})

	it('leaves the proxy for the rest of the transform to finish, as React Native bundles it', () => {
		const preset = require.resolve('@react-native/babel-preset', {
			paths: [require.resolve('@react-native/metro-config')],
		})
		const result = transformSync(COMPONENT, {
			babelrc: false,
			caller: { name: 'metro', platform: 'ios' } as never,
			configFile: false,
			filename: '/app/src/Chart.tsx',
			plugins: [useDomPlugin],
			presets: [preset],
		})

		expect(result?.code).toContain('require("react-native-use-dom")')
		expect(result?.code).not.toMatch(/^\s*(import|export) /mu)
	})

	it('leaves none of the original body in the native bundle', () => {
		const { code } = compile(COMPONENT, { platform: 'ios' })

		expect(code).not.toContain('svg')
		expect(code).not.toContain('points')
		expect(code).not.toContain('use dom')
	})

	it('erases a module that imports browser-only code, without resolving the import', () => {
		const { code } = compile(
			`'use dom';
       import 'some-enormous-charting-library';
       export default () => <div />;`,
			{ platform: 'android' },
		)

		expect(code).not.toContain('some-enormous-charting-library')
	})

	it('records the file in metadata so the bundler can collect it', () => {
		expect(compile(COMPONENT, { platform: 'ios' }).metadata).toEqual({
			erased: true,
			filePath: '/app/src/Chart.tsx',
		})
	})

	it('keeps type-only exports out of the way', () => {
		expect(() =>
			compile(
				`'use dom';
         export type Props = { a: number };
         export interface Other { b: string }
         export default (props: Props) => <div />;`,
				{ platform: 'ios' },
			),
		).not.toThrow()
	})
})

describe('on web', () => {
	it('leaves the module exactly as written', () => {
		const { code } = compile(COMPONENT, { platform: 'web' })

		expect(code).toContain('function Chart')
		expect(code).not.toContain('createDomComponentProxy')
	})

	it('records the file but marks it as not erased', () => {
		expect(compile(COMPONENT, { platform: 'web' }).metadata).toEqual({
			erased: false,
			filePath: '/app/src/Chart.tsx',
		})
	})
})

describe('modules without the directive', () => {
	it('are untouched', () => {
		const { code, metadata } = compile(`export default () => <div />;`, { platform: 'ios' })

		expect(code).not.toContain('createDomComponentProxy')
		expect(metadata).toBeUndefined()
	})

	it('are untouched when the directive is not the first statement', () => {
		const { code } = compile(
			`const a = 1;
       'use dom';
       export default () => <div />;`,
			{ platform: 'ios' },
		)

		expect(code).not.toContain('createDomComponentProxy')
	})
})

describe('invalid module shapes', () => {
	it('rejects a module with no default export, naming the file', () => {
		const error = capture(() => compile(`'use dom'; export const Chart = () => <div />;`, { platform: 'ios' }))

		expect(error.code).toBe(DomErrorCode.InvalidModuleExports)
		expect(error.message).toContain('/app/src/Chart.tsx')
	})

	it('rejects a value-level named export, naming the export', () => {
		const error = capture(() =>
			compile(`'use dom'; export const helper = 1; export default () => <div />;`, {
				platform: 'ios',
			}),
		)

		expect(error.code).toBe(DomErrorCode.InvalidModuleExports)
		expect(error.message).toContain('`helper`')
	})

	it('rejects a named function export', () => {
		const error = capture(() =>
			compile(`'use dom'; export function helper() {} export default () => <div />;`, {
				platform: 'ios',
			}),
		)

		expect(error.message).toContain('`helper`')
	})

	it('rejects a re-export specifier', () => {
		const error = capture(() =>
			compile(`'use dom'; const a = 1; export { a }; export default () => <div />;`, {
				platform: 'ios',
			}),
		)

		expect(error.message).toContain('`a`')
	})

	it('rejects `export *`', () => {
		const error = capture(() =>
			compile(`'use dom'; export * from './other'; export default () => <div />;`, {
				platform: 'ios',
			}),
		)

		expect(error.message).toContain('`export *`')
	})

	it('states the fix', () => {
		const error = capture(() =>
			compile(`'use dom'; export const helper = 1; export default () => <div />;`, {
				platform: 'ios',
			}),
		)

		expect(error.fix).toContain('separate module')
	})
})
