import { DEV_PAGE_PATH } from '../runtime/paths';
import type { DevFixture } from './__fixtures__/dev-server';
import { BROKEN, HELLO, PASSED_THROUGH, startDevFixture, waitFor } from './__fixtures__/dev-server';

jest.setTimeout(120_000);

let fixture: DevFixture;

beforeAll(async () => {
	fixture = await startDevFixture();
});

afterAll(async () => {
	await fixture.close();
});

it('passes requests outside /_dom to the next middleware untouched', async () => {
	const response = await fetch(`${fixture.origin}/index.bundle?platform=ios`);

	expect(await response.text()).toBe(PASSED_THROUGH);
});

it('answers unknown /_dom routes itself', async () => {
	expect((await fetch(`${fixture.origin}/_dom/elsewhere.js`)).status).toBe(404);
});

it('refuses a page without a component', async () => {
	expect((await fetch(`${fixture.origin}${DEV_PAGE_PATH}`)).status).toBe(400);
});

it('serves a page that renders the component with the injected props', async () => {
	const { dom } = await fixture.openPage();

	const text = await waitFor('the component', () => dom.window.document.querySelector('#root')?.textContent);
	expect(text).toBe('hello dom');
	dom.window.close();
});

it('builds the bundle for the web, with an inline source map', async () => {
	const bundle = await (await fixture.fetchBundle()).text();

	expect(bundle).toContain('mountDomComponent');
	expect(bundle).not.toContain('react-native/Libraries');
	expect(bundle).toContain('//# sourceMappingURL=data:application/json');
});

it('leaves the start-up banner to the dev server the developer started', () => {
	// By now the pages and bundles above have started the web bundler.
	expect(fixture.reported.map((event) => event.type)).not.toContain('dep_graph_loading');
});

it('shows a build error with its location, reports it, and reloads once it is fixed', async () => {
	fixture.writeComponent(BROKEN);
	fixture.reported.length = 0;
	// Metro sees the edit through its file watcher, a moment after it is written.
	await waitFor('the watcher to see the edit', async () => !(await fixture.fetchBundle()).ok);
	const { dom, reloaded } = await fixture.openPage();

	try {
		const shown = await waitFor(
			'the build error',
			() => dom.window.document.querySelector('#use-dom-build-error')?.textContent,
		);
		expect(shown).toContain(`${fixture.component}:`);
		expect(fixture.reported.map((event) => event.type)).toContain('bundling_error');

		fixture.writeComponent(HELLO);
		await waitFor('the reload', reloaded);
	} finally {
		fixture.writeComponent(HELLO);
		dom.window.close();
	}
});
