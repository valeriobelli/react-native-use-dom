import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@jest/globals'

import { buildMatrix, pickVersion } from './matrix.mjs'
import { bundledReactNative, cellOverrides, parseSupportTable, reactNativeVersions, stringMap } from './sources.mjs'

/**
 * The fixtures hold saved copies of the sources the CLI fetches, trimmed to the versions that
 * matter, taken on 2026-10-03.
 */
const FIXTURES = path.resolve(__dirname, '__fixtures__')

const supportTable = readFileSync(path.join(FIXTURES, 'support-table.md'), 'utf8')

/** @type {string[]} */
const rnVersions = JSON.parse(readFileSync(path.join(FIXTURES, 'react-native-versions.json'), 'utf8'))

/** @type {Record<string, string>} */
const expoTags = JSON.parse(readFileSync(path.join(FIXTURES, 'expo-dist-tags.json'), 'utf8'))

/** @type {Record<string, string>} */
const bundledRn = JSON.parse(readFileSync(path.join(FIXTURES, 'bundled-native-modules.json'), 'utf8'))

const overrides = {
	'bare-0.81': { ios: { runner: 'macos-26', xcode: '26.3' } },
	'bare-0.87': { appName: 'BareExample' },
	'expo-57': { appName: 'ReactNativeUseDomExpoExample' },
}

/**
 * Builds the matrix from the fixtures, with one source replaced.
 */
function buildFixtureMatrix({ rnVersions: versions = rnVersions, supportTable: table = supportTable } = {}) {
	return buildMatrix({ bundledRn, date: '2026-10-03', expoTags, overrides, rnVersions: versions, supportTable: table })
}

test('the matrix covers the supported window and the floor', () => {
	expect(buildFixtureMatrix()).toEqual({
		cells: [
			{
				appName: 'BareExample085',
				bundleId: 'dev.reactnativeusedom.bare085',
				expo: null,
				folder: 'examples/bare-0.85',
				id: 'bare-0.85',
				ios: { runner: 'xcode-27' },
				kind: 'bare',
				reactNative: '0.85.3',
				role: 'blocking',
				slug: 'bare085',
				support: 'End of Cycle',
			},
			{
				appName: 'BareExample086',
				bundleId: 'dev.reactnativeusedom.bare086',
				expo: null,
				folder: 'examples/bare-0.86',
				id: 'bare-0.86',
				ios: { runner: 'xcode-27' },
				kind: 'bare',
				reactNative: '0.86.3',
				role: 'blocking',
				slug: 'bare086',
				support: 'Active',
			},
			{
				appName: 'BareExample',
				bundleId: 'dev.reactnativeusedom.bare087',
				expo: null,
				folder: 'examples/bare-0.87',
				id: 'bare-0.87',
				ios: { runner: 'xcode-27' },
				kind: 'bare',
				reactNative: '0.87.1',
				role: 'blocking',
				slug: 'bare087',
				support: 'Active',
			},
			{
				appName: 'BareExample088',
				bundleId: 'dev.reactnativeusedom.bare088',
				expo: null,
				folder: 'examples/bare-0.88',
				id: 'bare-0.88',
				ios: { runner: 'xcode-27' },
				kind: 'bare',
				reactNative: '0.88.0-rc.3',
				role: 'blocking',
				slug: 'bare088',
				support: 'Future',
			},
			{
				appName: 'ExpoExample56',
				bundleId: 'dev.reactnativeusedom.expo56',
				expo: '56.0.23',
				folder: 'examples/expo-56',
				id: 'expo-56',
				ios: { runner: 'macos-26' },
				kind: 'expo',
				reactNative: '0.85.3',
				role: 'blocking',
				slug: 'expo56',
				support: 'End of Cycle',
			},
			{
				appName: 'ReactNativeUseDomExpoExample',
				bundleId: 'dev.reactnativeusedom.expo57',
				expo: '57.0.26',
				folder: 'examples/expo-57',
				id: 'expo-57',
				ios: { runner: 'xcode-27' },
				kind: 'expo',
				reactNative: '0.86.3',
				role: 'blocking',
				slug: 'expo57',
				support: 'Active',
			},
			{
				appName: 'ExpoExample58',
				bundleId: 'dev.reactnativeusedom.expo58',
				expo: '58.0.2',
				folder: 'examples/expo-58',
				id: 'expo-58',
				ios: { runner: 'xcode-27' },
				kind: 'expo',
				reactNative: '0.88.0-rc.3',
				role: 'blocking',
				slug: 'expo58',
				support: 'Future',
			},
			{
				appName: 'BareExample081',
				bundleId: 'dev.reactnativeusedom.bare081',
				expo: null,
				folder: 'examples/bare-0.81',
				id: 'bare-0.81',
				ios: { runner: 'macos-26', xcode: '26.3' },
				kind: 'bare',
				reactNative: '0.81.6',
				role: 'floor',
				slug: 'bare081',
				support: 'Unsupported',
			},
		],
		generatedAt: '2026-10-03',
	})
})

test('a future minor enters the matrix only once it has a release candidate', () => {
	const ids = buildFixtureMatrix().cells.map((cell) => cell.id)

	expect(ids).not.toContain('bare-0.89')

	const withCandidate = buildFixtureMatrix({ rnVersions: [...rnVersions, '0.89.0-rc.0'] })

	expect(withCandidate.cells.map((cell) => cell.id)).toContain('bare-0.89')
})

test('expo sdks whose react native minor is outside the window produce no cell', () => {
	const ids = buildFixtureMatrix().cells.map((cell) => cell.id)

	expect(ids).not.toContain('expo-54')
	expect(ids).not.toContain('expo-55')
})

test('the support table is rejected when its columns or levels change', () => {
	expect(() => parseSupportTable('| Version | Release date |\n| --- | --- |\n| 0.87.x | 2026-08-10 |')).toThrow(
		'the React Native support table has no Version or Support column',
	)

	expect(() => parseSupportTable(supportTable.replace('Active', 'Mostly stable'))).toThrow(
		'which is not a known support level',
	)

	expect(() => parseSupportTable(supportTable.replace('0.87.x', '0.87'))).toThrow('which is not a React Native minor')

	expect(() =>
		buildFixtureMatrix({ rnVersions: rnVersions.filter((version) => !version.startsWith('0.85.')) }),
	).toThrow('React Native 0.85 is End of Cycle but has no published version to test')
})

test('pickVersion takes the highest stable, and the highest release candidate for the future', () => {
	expect(pickVersion('0.86', rnVersions, {})).toBe('0.86.3')
	expect(pickVersion('0.88', rnVersions, { future: true })).toBe('0.88.0-rc.3')
	expect(pickVersion('0.88', rnVersions, {})).toBeNull()
	expect(pickVersion('0.89', rnVersions, { future: true })).toBeNull()
})

test('the source readers reject shapes they do not recognize', () => {
	expect(() => stringMap({ 'sdk-57': 57 }, 'the expo dist-tags')).toThrow('which is not a string')
	expect(() => bundledReactNative({ 'react-native': 86 })).toThrow('holds no react-native version')
	expect(() => reactNativeVersions({ tags: {} })).toThrow('holds no versions object')
	expect(() => cellOverrides({ 'expo-56': { appName: 'Example', ios: { runner: 'macos-26' } } })).not.toThrow()
	expect(() => cellOverrides({ 'expo-56': { ios: { runner: 26 } } })).toThrow('which is not a string')
	expect(() => cellOverrides({ 'expo-56': { ios: { xcode: 26 } } })).toThrow('which is not a string')
	expect(() => cellOverrides({ 'expo-56': 'macos-26' })).toThrow('is not an object')
})

test('only an override gives a cell an Xcode version', () => {
	expect(cellOverrides({ 'bare-0.81': { ios: { runner: 'macos-26', xcode: '26.3' } } })).toEqual({
		'bare-0.81': { ios: { runner: 'macos-26', xcode: '26.3' } },
	})

	expect(cellOverrides({ 'bare-0.81': { ios: { xcode: '26.3' } } })).toEqual({
		'bare-0.81': { ios: { xcode: '26.3' } },
	})

	const { cells } = buildFixtureMatrix()

	expect(cells.filter((cell) => cell.ios.xcode !== undefined).map((cell) => cell.id)).toEqual(['bare-0.81'])
})
