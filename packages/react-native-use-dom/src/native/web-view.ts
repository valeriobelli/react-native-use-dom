import type * as Nitro from 'react-native-nitro-modules';
import type { ReactNativeView, ViewConfig } from 'react-native-nitro-modules';

import { DomError, DomErrorCode } from '../runtime/errors';
import type { RNUseDomWebViewMethods, RNUseDomWebViewProps } from './specs/RNUseDomWebView.nitro';

/** The native view, and Nitro's wrapper for the functions passed to it. */
export interface NativeView {
	RNUseDomWebView: ReactNativeView<RNUseDomWebViewProps, RNUseDomWebViewMethods>;
	callback: typeof Nitro.callback;
}

let nativeView: NativeView | undefined;

/**
 * The native view. Internal: everything a developer touches goes through the component proxy.
 *
 * Loaded on first render rather than on import: Nitro throws as soon as it is imported in an app
 * without its native module, such as Expo Go, which is checked for first so that the error says what
 * to do instead.
 */
export function loadNativeView(): NativeView {
	if (isExpoGo()) {
		throw new DomError(DomErrorCode.ExpoGoUnsupported, "DOM components can't render in Expo Go.", {
			fix: "Expo Go doesn't include react-native-use-dom's native view. Run the app as a development build: `npx expo run:ios`, `npx expo run:android` or EAS Build (https://docs.expo.dev/develop/development-builds/create-a-build/).",
		});
	}
	nativeView ??= createNativeView();
	return nativeView;
}

function createNativeView(): NativeView {
	// eslint-disable-next-line
	const nitro = require('react-native-nitro-modules') as typeof Nitro;
	// Required at runtime rather than imported, so that the generated file stays outside the TypeScript
	// source tree: nitrogen owns `nitrogen/generated`, and it is regenerated from the spec on demand.
	// eslint-disable-next-line
	const viewConfig =
		require('../../nitrogen/generated/shared/json/RNUseDomWebViewConfig.json') as ViewConfig<RNUseDomWebViewProps>;
	return {
		RNUseDomWebView: nitro.getHostComponent<RNUseDomWebViewProps, RNUseDomWebViewMethods>(
			'RNUseDomWebView',
			() => viewConfig,
		),
		callback: nitro.callback,
	};
}

interface ExpoGlobal {
	expo?: { modules?: { ExponentConstants?: { appOwnership?: unknown } } };
}

/**
 * Whether the app runs in Expo Go, as Expo's own constants module reports it. Its `appOwnership` is
 * `'expo'` in Expo Go only; `executionEnvironment` doesn't tell Expo Go from a development build.
 */
function isExpoGo(): boolean {
	return (globalThis as ExpoGlobal).expo?.modules?.ExponentConstants?.appOwnership === 'expo';
}

export type { RNUseDomWebViewMethods, RNUseDomWebViewProps };
