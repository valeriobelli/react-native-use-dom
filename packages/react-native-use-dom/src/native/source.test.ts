import { DomError, DomErrorCode } from '../runtime/errors'
import { DEV_PAGE_PATH } from '../runtime/paths'
import { resolveDomSource } from './source'

const native = { os: 'ios', scriptURL: '' }

jest.mock('react-native', () => ({
	Platform: {
		get OS() {
			return native.os
		},
	},
	TurboModuleRegistry: {
		get: (name: string) => (name === 'SourceCode' ? { getConstants: () => ({ scriptURL: native.scriptURL }) } : null),
	},
}))

const FILE = '/app/src/Chart.tsx'

describe('resolveDomSource', () => {
	it('builds the page on the dev server the bundle was loaded from', () => {
		native.scriptURL = 'http://192.168.1.4:8081/index.bundle?platform=ios&dev=true'

		const { pagesDirectory, source } = resolveDomSource({ bundleFile: 'ignored.html', filePath: FILE })
		const url = new URL(source)

		expect(url.origin).toBe('http://192.168.1.4:8081')
		expect(url.pathname).toBe(DEV_PAGE_PATH)
		expect(Object.fromEntries(url.searchParams)).toEqual({ dev: 'true', file: FILE, platform: 'web' })
		expect(pagesDirectory).toBe('')
	})

	it.each([
		['ios', 'use-dom://localhost/dom.bundle/chart.html'],
		['android', 'https://use-dom.localhost/dom.bundle/chart.html'],
	])('loads the page on the offline origin on %s when the bundle is on the device', (os, expected) => {
		native.os = os
		native.scriptURL = 'file:///data/app/index.android.bundle'

		expect(resolveDomSource({ bundleFile: 'chart.html', filePath: FILE }).source).toBe(expected)
	})

	it.each([
		[
			'the iOS app bundle',
			'ios',
			'file:///private/var/containers/Bundle/Application/ID/App.app/main.jsbundle',
			'file:///private/var/containers/Bundle/Application/ID/App.app/dom.bundle',
		],
		['the Android APK assets', 'android', 'assets://index.android.bundle', 'assets://dom.bundle'],
		[
			'an Android bundle on device storage',
			'android',
			'/data/user/0/dev.app/files/bundle-store/0199/index.android.bundle',
			'file:///data/user/0/dev.app/files/bundle-store/0199/dom.bundle',
		],
		[
			'an iOS bundle in the documents folder',
			'ios',
			'file:///var/mobile/Containers/Data/Application/ID/Documents/bundle-store/0199/index.ios.bundle',
			'file:///var/mobile/Containers/Data/Application/ID/Documents/bundle-store/0199/dom.bundle',
		],
	])('serves the pages next to %s', (_where, os, scriptURL, expected) => {
		native.os = os
		native.scriptURL = scriptURL

		expect(resolveDomSource({ bundleFile: 'chart.html', filePath: FILE }).pagesDirectory).toBe(expected)
	})

	it('serves from no folder when the bundle location is unknown', () => {
		native.scriptURL = ''

		expect(resolveDomSource({ bundleFile: 'chart.html', filePath: FILE }).pagesDirectory).toBe('')
	})

	it('explains the missing Metro config when a release build has no page', () => {
		native.scriptURL = ''

		let thrown: unknown

		try {
			resolveDomSource({ filePath: FILE })
		} catch (error) {
			thrown = error
		}

		expect(thrown).toBeInstanceOf(DomError)
		expect((thrown as DomError).code).toBe(DomErrorCode.MissingMetroConfig)
	})
})
