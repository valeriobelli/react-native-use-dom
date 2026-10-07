import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, expect, test } from '@jest/globals'

import { generateBare } from './generate-bare.mjs'
import { addSceneManifest, APP_DELEGATE, applySceneLifeCycle, sceneDelegate } from './generate-bare.scene.mjs'

const PLIST = `<dict>
	<key>RCTNewArchEnabled</key>
	<true/>
	<key>UILaunchStoryboardName</key>
	<string>LaunchScreen</string>
</dict>
`

/**
 * @param {string} id
 * @returns {import('./matrix.mjs').MatrixCell}
 */
function cell(id) {
	return {
		appName: `App${id.replaceAll(/[-.]/gu, '')}`,
		bundleId: 'dev.reactnativeusedom.app',
		expo: null,
		folder: `examples/${id}`,
		id,
		ios: { runner: 'xcode-27' },
		kind: 'bare',
		reactNative: '0.86.3',
		role: 'blocking',
		slug: 'app',
		support: 'Active',
	}
}

let root = ''

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), 'generate-bare-scene-'))
})

afterEach(() => {
	rmSync(root, { force: true, recursive: true })
})

/**
 * Writes the iOS folder of a template: with a `SceneDelegate.swift` when it ships one.
 *
 * @param {import('./matrix.mjs').MatrixCell} target
 * @param {boolean} withScene
 */
function writeIos(target, withScene) {
	const app = path.join(root, target.folder, 'ios', target.appName)

	mkdirSync(app, { recursive: true })
	writeFileSync(path.join(app, 'AppDelegate.swift'), 'template app delegate\n')
	writeFileSync(path.join(app, 'Info.plist'), PLIST)

	writeFileSync(
		path.join(root, target.folder, 'package.json'),
		JSON.stringify({ dependencies: { 'react-native': '0.86.3' } }),
	)

	if (withScene) {
		writeFileSync(path.join(app, 'SceneDelegate.swift'), 'template scene delegate\n')
	}
}

test('the scene manifest goes before the launch storyboard, and only once', () => {
	const patched = addSceneManifest(PLIST)

	expect(patched.indexOf('UIApplicationSceneManifest')).toBeGreaterThan(patched.indexOf('RCTNewArchEnabled'))
	expect(patched.indexOf('UIApplicationSceneManifest')).toBeLessThan(patched.indexOf('UILaunchStoryboardName'))
	expect(patched).toContain('$(PRODUCT_MODULE_NAME).SceneDelegate')
	expect(addSceneManifest(patched)).toBe(patched)
	expect(() => addSceneManifest('<dict></dict>')).toThrow('UILaunchStoryboardName')
})

test('a template without a scene delegate gets one, and a second run changes nothing', () => {
	const target = cell('bare-0.86')
	/** @type {string[][]} */
	const added = []

	writeIos(target, false)

	const options = {
		/**
		 * @param {string} project
		 * @param {string} name
		 */
		addToProject: (project, name) => {
			added.push([path.relative(root, project), name])
		},
		cell: target,
		root,
	}

	expect(applySceneLifeCycle(options)).toBe(true)

	const app = path.join(root, target.folder, 'ios', target.appName)
	const delegate = readFileSync(path.join(app, 'SceneDelegate.swift'), 'utf8')

	expect(delegate).toBe(sceneDelegate(target.appName))
	expect(delegate).toContain(`withModuleName: "${target.appName}"`)
	expect(readFileSync(path.join(app, 'AppDelegate.swift'), 'utf8')).toBe(APP_DELEGATE)
	expect(readFileSync(path.join(app, 'Info.plist'), 'utf8')).toContain('UIApplicationSceneManifest')
	expect(added).toEqual([[`examples/bare-0.86/ios/${target.appName}.xcodeproj`, target.appName]])

	expect(applySceneLifeCycle(options)).toBe(false)
	expect(added).toHaveLength(1)
})

test('a template that ships a scene delegate is left alone', () => {
	const target = cell('bare-0.88')

	writeIos(target, true)

	expect(applySceneLifeCycle({ addToProject: () => {}, cell: target, root })).toBe(false)

	const app = path.join(root, target.folder, 'ios', target.appName)

	expect(readFileSync(path.join(app, 'AppDelegate.swift'), 'utf8')).toBe('template app delegate\n')
	expect(readFileSync(path.join(app, 'Info.plist'), 'utf8')).toBe(PLIST)
})

test('the generator patches the existing folders that lack a scene delegate and skips the others', () => {
	const old = cell('bare-0.86')
	const current = cell('bare-0.88')

	writeIos(old, false)
	writeIos(current, true)

	/** @type {string[]} */
	const logged = []

	generateBare({
		addToProject: () => {},
		cells: [old, current],
		hermesCompilerOf: () => null,
		log: (message) => {
			logged.push(message)
		},
		root,
		runInit: () => {},
	})

	expect(logged).toEqual(['giving examples/bare-0.86 the scene life cycle its template lacks'])
})
