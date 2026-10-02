import type { DomError } from '../runtime/errors'
import { DomErrorCode } from '../runtime/errors'
import { OFFLINE_BUNDLE_DIR } from '../runtime/paths'
import { readBundleCommand, resolveOutputDirectory } from './bundle-command'

describe('readBundleCommand', () => {
	it('reads the output arguments of a bundle run, in either spelling', () => {
		expect(
			readBundleCommand(['node', 'cli.js', 'bundle', '--bundle-output', 'out/main.jsbundle', '--assets-dest=out']),
		).toEqual({ assetsDest: 'out', bundleOutput: 'out/main.jsbundle' })
	})

	it('tells the dev server apart from a bundle run', () => {
		expect(readBundleCommand(['node', 'cli.js', 'start', '--port', '8081'])).toBeNull()
	})
})

describe('resolveOutputDirectory', () => {
	it('puts the pages among the assets on Android, next to the bundle', () => {
		const command = { assetsDest: '/build/res', bundleOutput: '/build/assets/index.android.bundle' }

		expect(resolveOutputDirectory(command, 'android')).toBe(`/build/assets/${OFFLINE_BUNDLE_DIR}`)
	})

	it("puts the pages in the app's resources on iOS", () => {
		const command = { assetsDest: '/build/App.app', bundleOutput: '/build/main.jsbundle' }

		expect(resolveOutputDirectory(command, 'ios')).toBe(`/build/App.app/${OFFLINE_BUNDLE_DIR}`)
	})

	it('names the missing argument when the pages have nowhere to go', () => {
		let thrown: unknown

		try {
			resolveOutputDirectory({ assetsDest: undefined, bundleOutput: '/build/main.jsbundle' }, 'ios')
		} catch (error) {
			thrown = error
		}

		expect((thrown as DomError).code).toBe(DomErrorCode.MissingBundleOutput)
		expect((thrown as DomError).message).toContain('--assets-dest')
	})
})
