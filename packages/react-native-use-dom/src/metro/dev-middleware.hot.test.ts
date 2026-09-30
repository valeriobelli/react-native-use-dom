import type { DevFixture, Page } from './__fixtures__/dev-server';
import { BROKEN, HELLO, startDevFixture, waitFor, withInput } from './__fixtures__/dev-server';

jest.setTimeout(120_000);

let fixture: DevFixture;

beforeAll(async () => {
	fixture = await startDevFixture();
});

afterAll(async () => {
	await fixture.close();
});

afterEach(() => {
	fixture.writeComponent(HELLO);
});

/**
 * Opens the page on a component greeting with `greeting`, once its bundle has it: Metro sees edits a
 * moment after they are written. Each test greets differently, so none opens on a previous one's.
 */
async function openWith(greeting: string): Promise<Page> {
	fixture.writeComponent(withInput(greeting));
	await waitFor('the watcher to see the edit', async () =>
		(await (await fixture.fetchBundle()).text()).includes(greeting),
	);
	const page = await fixture.openPage();
	await waitFor('the component', () => page.dom.window.document.querySelector('#typed'));
	// The page registers for updates as it starts; one sent before it did would never arrive.
	await new Promise((resolve) => {
		setTimeout(resolve, 500);
	});
	return page;
}

function textOf(page: Page): string {
	return page.dom.window.document.querySelector('#root')?.textContent ?? '';
}

it('updates the component in place, keeping what was typed into it', async () => {
	const page = await openWith('hallo');
	const input = await waitFor('the input', () => page.dom.window.document.querySelector<HTMLInputElement>('#typed'));
	input.value = 'typed before the edit';

	try {
		fixture.writeComponent(withInput('bonjour'));
		await waitFor('the update', () => textOf(page).includes('bonjour dom'));

		expect(page.dom.window.document.querySelector<HTMLInputElement>('#typed')).toBe(input);
		expect(input.value).toBe('typed before the edit');
		expect(page.reloaded()).toBe(false);
	} finally {
		page.dom.window.close();
	}
});

it('updates every page showing the component', async () => {
	const first = await openWith('salut');
	const second = await openWith('salut');

	try {
		fixture.writeComponent(withInput('hej'));
		await waitFor('the first update', () => textOf(first).includes('hej dom'));
		await waitFor('the second update', () => textOf(second).includes('hej dom'));

		expect([first.reloaded(), second.reloaded()]).toStrictEqual([false, false]);
	} finally {
		first.dom.window.close();
		second.dom.window.close();
	}
});

it('reloads the page once the dev server is back after it went away', async () => {
	const page = await openWith('servus');

	try {
		fixture.dropConnections();
		await waitFor('the reload', page.reloaded);

		expect(page.reloaded()).toBe(true);
	} finally {
		page.dom.window.close();
	}
});

it('reloads the page for an edit that cannot be applied in place', async () => {
	const page = await openWith('hola');

	try {
		// A module that exports more than components is no boundary Fast Refresh can stop at.
		fixture.writeComponent(`${withInput('hola')}export const notAComponent = 1;\n`);
		await waitFor('the reload', page.reloaded);

		expect(page.reloaded()).toBe(true);
	} finally {
		page.dom.window.close();
	}
});

it('shows a build error over the component, and takes it away once the edit builds', async () => {
	const page = await openWith('ciao');
	const { document } = page.dom.window;

	try {
		fixture.writeComponent(BROKEN);
		const shown = await waitFor('the build error', () => document.querySelector('#use-dom-hot-error')?.textContent);
		expect(shown).toContain(fixture.component);
		// The component is still underneath, for when the edit is fixed.
		expect(document.querySelector('#typed')).not.toBeNull();

		fixture.writeComponent(withInput('fixed'));
		await waitFor('the update', () => textOf(page).includes('fixed dom'));
		expect(document.querySelector('#use-dom-hot-error')).toBeNull();
		expect(page.reloaded()).toBe(false);
	} finally {
		page.dom.window.close();
	}
});
