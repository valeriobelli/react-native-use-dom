import { DomError, DomErrorCode } from '../runtime/errors';
import { loadNativeView } from './web-view';

jest.mock('react-native-nitro-modules', () => ({
	getHostComponent: (name: string) => ({ hostComponent: name }),
	callback: (f: unknown) => ({ f }),
}));

interface ExpoGlobal {
	expo?: { modules: { ExponentConstants: { appOwnership: string | null } } } | undefined;
}

function runIn(appOwnership: string | null): void {
	(globalThis as ExpoGlobal).expo = { modules: { ExponentConstants: { appOwnership } } };
}

function capture(run: () => void): DomError {
	try {
		run();
	} catch (error) {
		return error as DomError;
	}
	throw new Error('expected the call to throw, but it returned');
}

afterEach(() => {
	delete (globalThis as ExpoGlobal).expo;
});

describe('loadNativeView', () => {
	it('refuses to render in Expo Go, saying how to make a development build', () => {
		runIn('expo');

		const error = capture(() => loadNativeView());

		expect(error).toBeInstanceOf(DomError);
		expect(error.code).toBe(DomErrorCode.ExpoGoUnsupported);
		expect(error.fix).toContain('development build');
		expect(error.message).toMatchSnapshot();
	});

	it.each([
		['a bare app', undefined],
		['an Expo development build', { modules: { ExponentConstants: { appOwnership: null } } }],
	])('loads the native view in %s, once', (_app, expo) => {
		(globalThis as ExpoGlobal).expo = expo;

		const view = loadNativeView();

		expect(view.RNUseDomWebView).toStrictEqual({ hostComponent: 'RNUseDomWebView' });
		expect(loadNativeView()).toBe(view);
	});
});
