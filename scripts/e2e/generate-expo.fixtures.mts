/** The matrix cell, the template and the metadata the tests of the Expo generator share. */

import type { ExpoMetadata } from './generate-expo.config.mts'
import type { MatrixCell } from './matrix.mts'

/**
 * @param sdk the Expo SDK the cell pins
 * @param expo the exact `expo` version the cell pins
 * @param reactNative the react-native version the cell pins
 * @param support the support level the React Native schedule gives the minor
 */
export function cell(
	sdk: string,
	expo: string,
	reactNative = '0.86.3',
	support = 'Active',
): MatrixCell & { expo: string } {
	return {
		appName: `ExpoExample${sdk}`,
		bundleId: `dev.reactnativeusedom.expo${sdk}`,
		expo,
		folder: `examples/expo-${sdk}`,
		id: `expo-${sdk}`,
		ios: { runner: 'xcode-27' },
		kind: 'expo',
		reactNative,
		role: 'blocking',
		slug: `expo${sdk}`,
		support,
	}
}

/**
 * @param sdk the Expo SDK the metadata describes
 * @param reactNative the react-native version that SDK pins
 */
export function metadata(sdk: string, reactNative: string): ExpoMetadata {
	return {
		bundledNativeModules: {
			'expo-build-properties': `~${sdk}.0.9`,
			react: '19.2.3',
			'react-dom': '19.2.3',
			'react-native': reactNative,
			'react-native-safe-area-context': '~5.7.0',
		},
		dependencies: { 'babel-preset-expo': `~${sdk}.0.8` },
	}
}

export const templateManifest = {
	dependencies: { expo: '~57.0.0', 'expo-status-bar': '~57.0.0', react: '19.2.3', 'react-native': '0.86.3' },
	devDependencies: { '@types/react': '~19.2.2', typescript: '~6.0.3' },
	main: 'index.ts',
	name: 'expo-57',
	private: true,
	scripts: { android: 'expo start --android', start: 'expo start' },
	version: '1.0.0',
}

export const templateConfig = {
	expo: {
		android: { adaptiveIcon: { backgroundColor: '#E6F4FE' }, predictiveBackGestureEnabled: false },
		icon: './assets/icon.png',
		ios: { supportsTablet: true },
		name: 'expo-57',
		slug: 'expo-57',
		version: '1.0.0',
		web: { favicon: './assets/favicon.png' },
	},
}
