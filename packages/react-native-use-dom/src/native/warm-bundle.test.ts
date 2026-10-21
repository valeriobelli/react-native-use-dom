import { warmDomBundle } from './warm-bundle'

const fetchMock = jest.fn<Promise<Response>, [string]>()

beforeAll(() => {
	globalThis.fetch = fetchMock as unknown as typeof fetch
})

beforeEach(() => {
	fetchMock.mockReset()
})

/** Lets every pending promise job settle before asserting. */
function flush(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0)
	})
}

describe('warmDomBundle', () => {
	it('requests each bundle once, however many instances render it', () => {
		fetchMock.mockResolvedValue(new Response(''))

		warmDomBundle({ url: 'http://localhost:8081/_dom/entry.bundle?a' })
		warmDomBundle({ url: 'http://localhost:8081/_dom/entry.bundle?a' })

		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('ignores a dev server that cannot be reached, which the page reports itself', async () => {
		const unhandled = jest.fn()

		process.on('unhandledRejection', unhandled)
		fetchMock.mockRejectedValue(new TypeError('Network request failed'))

		warmDomBundle({ url: 'http://localhost:8081/_dom/entry.bundle?b' })
		await flush()

		process.off('unhandledRejection', unhandled)
		expect(unhandled).not.toHaveBeenCalled()
	})
})
