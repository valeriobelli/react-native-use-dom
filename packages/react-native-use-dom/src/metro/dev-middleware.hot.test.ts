import type { DevFixture, Page } from './__fixtures__/dev-server'
import { BROKEN, HELLO, startDevFixture, waitFor, withInput, withStylesheet } from './__fixtures__/dev-server'
import { STYLESHEET_ATTRIBUTE } from './transform-worker'

jest.setTimeout(120_000)

let fixture: DevFixture

beforeAll(async () => {
	fixture = await startDevFixture()
})

afterAll(async () => {
	await fixture.close()
})

afterEach(() => {
	fixture.writeComponent(HELLO)
})

/**
 * Opens the page on a component greeting with `greeting`, once its bundle has it: Metro sees edits a
 * moment after they are written. Each test greets differently, so none opens on a previous one's.
 */
async function openWith(greeting: string, source = withInput(greeting)): Promise<Page> {
	fixture.writeComponent(source)

	await waitFor('the watcher to see the edit', async () =>
		(await (await fixture.fetchBundle()).text()).includes(greeting),
	)
	const page = await fixture.openPage()

	await waitFor('the component', () => page.dom.window.document.querySelector('#typed'))

	// The page registers for updates as it starts; one sent before it did would never arrive.
	await new Promise((resolve) => {
		setTimeout(resolve, 500)
	})

	return page
}

function textOf(page: Page): string {
	return page.dom.window.document.querySelector('#root')?.textContent ?? ''
}

it('updates the component in place, keeping what was typed into it', async () => {
	const page = await openWith('hallo')
	const input = await waitFor('the input', () => page.dom.window.document.querySelector<HTMLInputElement>('#typed'))

	input.value = 'typed before the edit'

	try {
		fixture.writeComponent(withInput('bonjour'))
		await waitFor('the update', () => textOf(page).includes('bonjour dom'))

		expect(page.dom.window.document.querySelector<HTMLInputElement>('#typed')).toBe(input)
		expect(input.value).toBe('typed before the edit')
		expect(page.reloaded()).toBe(false)
	} finally {
		page.dom.window.close()
	}
})

it('applies an edited stylesheet in place', async () => {
	fixture.writeStylesheet('label { color: red; }\n')
	const page = await openWith('hei', withStylesheet('hei'))
	const { document } = page.dom.window
	const styles = (): string =>
		[...document.querySelectorAll(`style[${STYLESHEET_ATTRIBUTE}]`)].map((style) => style.textContent).join('')

	try {
		expect(styles()).toContain('color: red')

		fixture.writeStylesheet('label { color: blue; }\n')
		await waitFor('the update', () => styles().includes('color: blue'))

		expect(styles()).not.toContain('color: red')
		expect(document.querySelectorAll(`style[${STYLESHEET_ATTRIBUTE}]`)).toHaveLength(1)
		expect(page.reloaded()).toBe(false)
	} finally {
		page.dom.window.close()
	}
})

it('updates every page showing the component', async () => {
	const first = await openWith('salut')
	const second = await openWith('salut')

	try {
		fixture.writeComponent(withInput('hej'))
		await waitFor('the first update', () => textOf(first).includes('hej dom'))
		await waitFor('the second update', () => textOf(second).includes('hej dom'))

		expect([first.reloaded(), second.reloaded()]).toStrictEqual([false, false])
	} finally {
		first.dom.window.close()
		second.dom.window.close()
	}
})

it('reloads the page once the dev server is back after it went away', async () => {
	const page = await openWith('servus')

	try {
		fixture.dropConnections()
		await waitFor('the reload', () => page.reloaded())

		expect(page.reloaded()).toBe(true)
	} finally {
		page.dom.window.close()
	}
})

it('reloads the page for an edit that cannot be applied in place', async () => {
	const page = await openWith('hola')

	try {
		// A module that exports more than components is no boundary Fast Refresh can stop at.
		fixture.writeComponent(`${withInput('hola')}export const notAComponent = 1;\n`)
		await waitFor('the reload', () => page.reloaded())

		expect(page.reloaded()).toBe(true)
	} finally {
		page.dom.window.close()
	}
})

it('shows a build error over the component, and takes it away once the edit builds', async () => {
	const page = await openWith('ciao')
	const { document } = page.dom.window

	try {
		fixture.writeComponent(BROKEN)
		const shown = await waitFor('the build error', () => document.querySelector('#use-dom-hot-error')?.textContent)

		expect(shown).toContain(fixture.component)
		// The component is still underneath, for when the edit is fixed.
		expect(document.querySelector('#typed')).not.toBeNull()

		fixture.writeComponent(withInput('fixed'))
		await waitFor('the update', () => textOf(page).includes('fixed dom'))
		expect(document.querySelector('#use-dom-hot-error')).toBeNull()
		expect(page.reloaded()).toBe(false)
	} finally {
		page.dom.window.close()
	}
})
