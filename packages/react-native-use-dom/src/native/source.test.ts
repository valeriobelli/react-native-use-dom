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

		const url = new URL(resolveDomSource({ filePath: FILE, bundleFile: 'ignored.html' }))

		expect(url.origin).toBe('http://192.168.1.4:8081')
		expect(url.pathname).toBe(DEV_PAGE_PATH)
		expect(Object.fromEntries(url.searchParams)).toEqual({ file: FILE, platform: 'web', dev: 'true' })
	})

	it.each([
		['ios', 'use-dom://localhost/dom.bundle/chart.html'],
		['android', 'https://use-dom.localhost/dom.bundle/chart.html'],
	])('loads the embedded page on %s when the bundle comes from the app', (os, expected) => {
		native.os = os
		native.scriptURL = 'file:///data/app/index.android.bundle'

		expect(resolveDomSource({ filePath: FILE, bundleFile: 'chart.html' })).toBe(expected)
	})

	it('explains the missing Metro config when a release build has no embedded page', () => {
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
