import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, expect, test } from '@jest/globals'

import { localPods, lockedReactNative, staleBareFolders, updateStalePods } from './bare-pods.mts'

/**
 * The parts of a `Podfile.lock` the script reads, in the order CocoaPods writes them.
 *
 * @param reactNative the React Native version the lock was written for
 */
function podfileLock(reactNative: string): string {
	return [
		'PODS:',
		'  - boost (1.84.0)',
		`  - React-Core (${reactNative}):`,
		`    - React-Core/Default (= ${reactNative})`,
		`  - React-Core/Default (${reactNative}):`,
		'  - SocketRocket (0.7.1)',
		'',
		'DEPENDENCIES:',
		'  - React-Core (from `../node_modules/react-native/`)',
		'',
		'SPEC REPOS:',
		'  trunk:',
		'    - SocketRocket',
		'',
		'EXTERNAL SOURCES:',
		'  boost:',
		'    :podspec: "../node_modules/react-native/third-party-podspecs/boost.podspec"',
		'  hermes-engine:',
		'    :podspec: "../node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec"',
		'    :tag: hermes-2026-01-01',
		'  React-Core:',
		'    :path: "../node_modules/react-native/"',
		'  "React-Core-prebuilt":',
		'    :podspec: "../node_modules/react-native/React-Core-prebuilt.podspec"',
		'  ReactNativeUseDom:',
		'    :path: "../node_modules/react-native-use-dom"',
		'',
		'SPEC CHECKSUMS:',
		'  boost: 0123456789abcdef',
		'',
		'PODFILE CHECKSUM: 0123456789abcdef',
		'',
		'COCOAPODS: 1.15.2',
		'',
	].join('\n')
}

let root: string

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), 'bare-pods-'))
	mkdirSync(path.join(root, 'examples'))
})

afterEach(() => {
	rmSync(root, { force: true, recursive: true })
})

/**
 * @param example `name` is the folder's name, `pinned` is the version its `package.json` pins, and
 * `locked` is the version of its `Podfile.lock`, which it has none without
 */
function writeExample({ locked, name, pinned }: { locked?: string; name: string; pinned: string }): void {
	const folder = path.join(root, 'examples', name)

	mkdirSync(path.join(folder, 'ios'), { recursive: true })
	writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ dependencies: { 'react-native': pinned } }))

	if (locked) {
		writeFileSync(path.join(folder, 'ios', 'Podfile.lock'), podfileLock(locked))
	}
}

test('the version of React-Core is the React Native version of the lock', () => {
	expect(lockedReactNative({ lock: podfileLock('0.88.0-rc.4') })).toBe('0.88.0-rc.4')
	expect(lockedReactNative({ lock: 'PODS:\n  - boost (1.84.0)\n' })).toBeNull()
})

test('the local pods are those under EXTERNAL SOURCES, unquoted', () => {
	expect(localPods({ lock: podfileLock('0.86.3') })).toEqual([
		'boost',
		'hermes-engine',
		'React-Core',
		'React-Core-prebuilt',
		'ReactNativeUseDom',
	])

	expect(localPods({ lock: 'PODS:\n  - boost (1.84.0)\n' })).toEqual([])
})

test('a bare example whose lock names another version is stale, and the others are not', () => {
	writeExample({ locked: '0.88.0-rc.3', name: 'bare-0.88', pinned: '0.88.0-rc.4' })
	writeExample({ locked: '0.86.2', name: 'bare-0.86', pinned: '0.86.3' })
	writeExample({ locked: '0.87.1', name: 'bare-0.87', pinned: '0.87.1' })
	// A new example has no lock yet: it needs `pod install`, not an update.
	writeExample({ name: 'bare-0.89', pinned: '0.89.0-rc.0' })
	mkdirSync(path.join(root, 'examples', 'expo-57', 'ios'), { recursive: true })

	const stale = staleBareFolders({ root })

	expect(stale.map(({ folder, locked, pinned }) => ({ folder, locked, pinned }))).toEqual([
		{ folder: 'examples/bare-0.86', locked: '0.86.2', pinned: '0.86.3' },
		{ folder: 'examples/bare-0.88', locked: '0.88.0-rc.3', pinned: '0.88.0-rc.4' },
	])

	expect(stale[0]?.pods).toContain('React-Core')
})

test('only the stale examples have their local pods updated', () => {
	writeExample({ locked: '0.88.0-rc.3', name: 'bare-0.88', pinned: '0.88.0-rc.4' })
	writeExample({ locked: '0.87.1', name: 'bare-0.87', pinned: '0.87.1' })

	const updates: { folder: string; pods: string[] }[] = []

	const updated = updateStalePods({
		podUpdate: (update) => {
			updates.push(update)
		},
		root,
	})

	expect(updated).toEqual(['examples/bare-0.88'])
	expect(updates).toEqual([{ folder: 'examples/bare-0.88', pods: localPods({ lock: podfileLock('0.88.0-rc.3') }) }])
})
