import type { DomError } from '../runtime/errors'
import { DomErrorCode } from '../runtime/errors'
import { OFFLINE_BUNDLE_DIR } from '../runtime/paths'
import { readBundleCommand, resolveOutputDirectory } from './bundle-command'

describe('readBundleCommand', () => {
	it('reads the output arguments of a bundle run, in either spelling', () => {
		expect(
			readBundleCommand(['node', 'cli.js', 'bundle', '--bundle-output', 'out/main.jsbundle', '--assets-dest=out']),
		).toEqual({ bundleOutput: 'out/main.jsbundle', assetsDest: 'out' })
	})

	it('tells the dev server apart from a bundle run', () => {
		expect(readBundleCommand(['node', 'cli.js', 'start', '--port', '8081'])).toBeNull()
	})
})

describe('resolveOutputDirectory', () => {
	it('puts the pages among the assets on Android, next to the bundle', () => {
		const command = { bundleOutput: '/build/assets/index.android.bundle', assetsDest: '/build/res' }
		expect(resolveOutputDirectory(command, 'android')).toBe(`/build/assets/${OFFLINE_BUNDLE_DIR}`)
	})

	it("puts the pages in the app's resources on iOS", () => {
		const command = { bundleOutput: '/build/main.jsbundle', assetsDest: '/build/App.app' }
		expect(resolveOutputDirectory(command, 'ios')).toBe(`/build/App.app/${OFFLINE_BUNDLE_DIR}`)
	})

	it('names the missing argument when the pages have nowhere to go', () => {
		let thrown: unknown
		try {
			resolveOutputDirectory({ bundleOutput: '/build/main.jsbundle', assetsDest: undefined }, 'ios')
		} catch (error) {
			thrown = error
		}
		expect((thrown as DomError).code).toBe(DomErrorCode.MissingBundleOutput)
		expect((thrown as DomError).message).toContain('--assets-dest')
	})
})
