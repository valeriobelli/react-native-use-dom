import { DEV_HOT_PATH, DEV_PAGE_PATH } from '../runtime/paths'
import type { DevFixture } from './__fixtures__/dev-server'
import {
	BROKEN,
	HELLO,
	PASSED_THROUGH,
	PUBLIC_IMAGE,
	PUBLIC_IMAGE_SOURCE,
	startDevFixture,
	waitFor,
} from './__fixtures__/dev-server'

jest.setTimeout(120_000)

let fixture: DevFixture

beforeAll(async () => {
	fixture = await startDevFixture()
})

afterAll(async () => {
	await fixture.close()
})

it('passes requests outside /_dom to the next middleware untouched', async () => {
	const response = await fetch(`${fixture.origin}/index.bundle?platform=ios`)

	expect(await response.text()).toBe(PASSED_THROUGH)
})

it('answers unknown /_dom routes itself', async () => {
	expect((await fetch(`${fixture.origin}/_dom/elsewhere.js`)).status).toBe(404)
})

it("serves the files of the project's public folder", async () => {
	const image = await fetch(`${fixture.origin}/_dom/${PUBLIC_IMAGE}`)
	const font = await fetch(`${fixture.origin}/_dom/fonts/Inter.woff2`)

	expect(image.headers.get('content-type')).toBe('image/svg+xml')
	expect(await image.text()).toBe(PUBLIC_IMAGE_SOURCE)
	expect(font.headers.get('content-type')).toBe('font/woff2')
})

it('serves nothing outside the public folder', async () => {
	// Encoded, so that the URL keeps the dots a client would otherwise resolve before sending it.
	const outside = ['..%2Fpackage.json', 'fonts/..%2F..%2Fpackage.json', 'fonts']
	const statuses = await Promise.all(
		outside.map(async (escape) => (await fetch(`${fixture.origin}/_dom/${escape}`)).status),
	)

	expect(statuses).toStrictEqual([404, 404, 404])
})

it('refuses a page without a component', async () => {
	expect((await fetch(`${fixture.origin}${DEV_PAGE_PATH}`)).status).toBe(400)
})

it('serves a page that renders the component with the injected props', async () => {
	const { dom } = await fixture.openPage()

	const text = await waitFor('the component', () => dom.window.document.querySelector('#root')?.textContent)

	expect(text).toBe('hello dom')
	dom.window.close()
})

it('builds the bundle for the web, with an inline source map', async () => {
	const bundle = await (await fixture.fetchBundle()).text()

	expect(bundle).toContain('mountDomComponent')
	expect(bundle).not.toContain('react-native/Libraries')
	expect(bundle).toContain('//# sourceMappingURL=data:application/json')
})

it('leaves the start-up banner to the dev server the developer started', () => {
	// By now the pages and bundles above have started the web bundler.
	expect(fixture.reported.map((event) => event.type)).not.toContain('dep_graph_loading')
})

it('shows a build error with its location, reports it, and reloads once it is fixed', async () => {
	fixture.writeComponent(BROKEN)
	fixture.reported.length = 0
	// Metro sees the edit through its file watcher, a moment after it is written.
	await waitFor('the watcher to see the edit', async () => !(await fixture.fetchBundle()).ok)
	const page = await fixture.openPage()

	try {
		const shown = await waitFor(
			'the build error',
			() => page.dom.window.document.querySelector('#use-dom-build-error')?.textContent,
		)

		expect(shown).toContain(`${fixture.component}:`)
		expect(fixture.reported.map((event) => event.type)).toContain('bundling_error')

		fixture.writeComponent(HELLO)
		await waitFor('the reload', () => page.reloaded())
	} finally {
		fixture.writeComponent(HELLO)
		page.dom.window.close()
	}
})

it('closes the server while a page holds its hot socket open', async () => {
	// One request installs the upgrade routing, which the socket then goes through.
	await fetch(fixture.pageUrl())
	const socket = new WebSocket(`${fixture.origin.replace(/^http/u, 'ws')}${DEV_HOT_PATH}`)

	await new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true })

		socket.addEventListener(
			'error',
			() => {
				reject(new Error('the hot socket refused the connection'))
			},
			{ once: true },
		)
	})

	try {
		// A dev server's CLI closes through `close` and gives it a second: an open socket a page
		// holds must not hold the close past it, as one that survives it would.
		const closed = fixture.closeHttpServer().then(
			() => 'closed' as const,
			(error) => `refused: ${String(error)}`,
		)
		const outcome = await Promise.race([
			closed,
			new Promise<'held'>((resolve) => {
				setTimeout(() => {
					resolve('held')
				}, 1_000)
			}),
		])

		expect(outcome).toBe('closed')
	} finally {
		socket.close()
	}
})
