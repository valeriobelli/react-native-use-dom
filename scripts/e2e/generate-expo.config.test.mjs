import { expect, test } from '@jest/globals'

import { bumpManifest, wireAppConfig, wireManifest } from './generate-expo.config.mjs'
import { cell, metadata, templateConfig, templateManifest } from './generate-expo.fixtures.mjs'

test('a bump changes expo and nothing else', () => {
	expect(bumpManifest(templateManifest, '57.0.27')).toEqual({
		...templateManifest,
		dependencies: { ...templateManifest.dependencies, expo: '57.0.27' },
	})
})

test('the template manifest becomes the example manifest', () => {
	expect(wireManifest(templateManifest, cell('56', '56.0.23'), metadata('56', '0.86.3'))).toEqual({
		dependencies: {
			'@react-native-use-dom/example-app': 'workspace:*',
			expo: '56.0.23',
			react: '19.2.3',
			'react-dom': '19.2.3',
			'react-native': '0.86.3',
			'react-native-nitro-modules': 'catalog:',
			'react-native-safe-area-context': '~5.7.0',
			'react-native-use-dom': 'workspace:*',
		},
		devDependencies: { '@types/react': '~19.2.2', 'babel-preset-expo': '~56.0.8', typescript: '~6.0.3' },
		engines: { node: '>=22.12.0' },
		main: 'index.ts',
		name: 'expo-56',
		private: true,
		scripts: { android: 'expo run:android', ios: 'expo run:ios', start: 'expo start' },
		version: '0.0.1',
	})
})

/** @param {string} sdk */
function dependsOn(sdk) {
	const wired = wireManifest(templateManifest, cell(sdk, `${sdk}.0.1`), metadata(sdk, '0.86.3'))

	return Object.keys(wired.devDependencies ?? {}).includes('expo-build-properties')
}

/** @param {string} sdk */
function scene(sdk) {
	return JSON.stringify(wireAppConfig(templateConfig, cell(sdk, `${sdk}.0.1`))).includes('enableSceneSupport')
}

test('only SDK 57 depends on expo-build-properties', () => {
	expect(dependsOn('56')).toBe(false)
	expect(dependsOn('57')).toBe(true)
	expect(dependsOn('58')).toBe(false)
})

test('a manifest whose expo ships another react-native than the matrix is refused', () => {
	expect(() => wireManifest(templateManifest, cell('56', '56.0.23'), metadata('56', '0.85.3'))).toThrow(
		'expo 56.0.23 ships react-native 0.85.3, but the matrix says 0.86.3',
	)
})

test('the app config takes its names and ids from the cell, and has no web target', () => {
	const config = wireAppConfig(templateConfig, cell('56', '56.0.23')).expo

	expect(config).toMatchObject({
		android: { package: 'dev.reactnativeusedom.expo56', predictiveBackGestureEnabled: false },
		ios: { bundleIdentifier: 'dev.reactnativeusedom.expo56', supportsTablet: true },
		name: 'ExpoExample56',
		slug: 'ExpoExample56',
	})

	expect(config).not.toHaveProperty('web')
})

test('the scene option is set for SDK 57 only', () => {
	expect(scene('56')).toBe(false)
	expect(scene('57')).toBe(true)
	expect(scene('58')).toBe(false)

	expect(wireAppConfig(templateConfig, cell('57', '57.0.1')).expo.plugins).toEqual([
		['expo-build-properties', { ios: { enableSceneSupport: true } }],
	])
})
