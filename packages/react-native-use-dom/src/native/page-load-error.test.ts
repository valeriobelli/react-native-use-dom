import { DomErrorCode } from '../runtime/errors'
import { DomLoadError } from '../runtime/load-error'
import { reportPageLoadError, toPageLoadError } from './page-load-error'

const URL = 'use-dom://localhost/dom.bundle/0123456789abcdef.html'

describe('toPageLoadError', () => {
	it('reports a missing page with the page URL, its 404 status and a fix naming withDom and dom.bundle', () => {
		const error = toPageLoadError({ description: 'Not found', kind: 'notFound', status: 404, url: URL })

		expect(error).toBeInstanceOf(DomLoadError)
		expect(error.code).toBe(DomErrorCode.PageNotFound)
		expect(error.kind).toBe('notFound')
		expect(error.url).toBe(URL)
		expect(error.status).toBe(404)
		expect(error.fix).toContain('withDom')
		expect(error.fix).toContain('dom.bundle')
	})

	it('reports an HTTP failure with its status under the page-load-failed code', () => {
		const error = toPageLoadError({ description: 'Server error', kind: 'http', status: 500, url: URL })

		expect(error.code).toBe(DomErrorCode.PageLoadFailed)
		expect(error.kind).toBe('http')
		expect(error.url).toBe(URL)
		expect(error.status).toBe(500)
	})

	it('reports a network failure without a status', () => {
		const error = toPageLoadError({ description: 'The connection failed.', kind: 'network', url: URL })

		expect(error.code).toBe(DomErrorCode.PageLoadFailed)
		expect(error.kind).toBe('network')
		expect(error.status).toBeNull()
	})

	it('reports any other failure under the page-load-failed code', () => {
		const error = toPageLoadError({ description: 'Something else went wrong.', kind: 'other', url: URL })

		expect(error.code).toBe(DomErrorCode.PageLoadFailed)
		expect(error.kind).toBe('other')
		expect(error.status).toBeNull()
	})
})

describe('reportPageLoadError', () => {
	afterEach(() => {
		jest.restoreAllMocks()
	})

	it('hands the DomLoadError to the handler when one is set', () => {
		const onError = jest.fn()

		reportPageLoadError({ description: 'Not found', kind: 'notFound', status: 404, url: URL }, onError)

		expect(onError).toHaveBeenCalledTimes(1)
		const error = onError.mock.calls[0]?.[0]

		expect(error).toBeInstanceOf(DomLoadError)
		expect(error.code).toBe(DomErrorCode.PageNotFound)
	})

	it('logs the DomLoadError when there is no handler', () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

		reportPageLoadError({ description: 'The connection failed.', kind: 'network', url: URL }, undefined)

		expect(consoleError).toHaveBeenCalledTimes(1)
		const error = consoleError.mock.calls[0]?.[0]

		expect(error).toBeInstanceOf(DomLoadError)
		expect(error.code).toBe(DomErrorCode.PageLoadFailed)
	})
})
