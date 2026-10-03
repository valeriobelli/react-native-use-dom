import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, expect, test } from '@jest/globals'

import { bumpManifest, generateBare, planGeneration, wireManifest } from './generate-bare.mjs'

/**
 * @param {string} id
 * @param {string} reactNative
 * @param {string} role
 * @returns {import('./matrix.mjs').MatrixCell}
 */
function cell(id, reactNative, role = 'blocking') {
	const slug = id.replaceAll(/[-.]/gu, '')

	return {
		appName: `App${slug}`,
		bundleId: `dev.reactnativeusedom.${slug}`,
		expo: null,
		folder: `examples/${id}`,
		id,
		ios: { runner: 'xcode-27' },
		kind: 'bare',
		reactNative,
		role,
		slug,
		support: 'Active',
	}
}

const templateManifest = {
	dependencies: {
		'@react-native/new-app-screen': '0.86.3',
		react: '19.2.3',
		'react-native': '0.86.3',
		'react-native-safe-area-context': '^5.5.2',
	},
	devDependencies: {
		'@react-native-community/cli': '20.1.0',
		'@react-native/babel-preset': '0.86.3',
		'@react-native/eslint-config': '0.86.3',
		'@react-native/metro-config': '0.86.3',
		eslint: '^8.19.0',
		jest: '^29.6.3',
	},
	engines: { node: '>= 22.11.0' },
	name: 'dev.reactnativeusedom.bare086',
	private: true,
	scripts: { android: 'react-native run-android', lint: 'eslint .', start: 'react-native start', test: 'jest' },
	version: '0.0.1',
}

test('a cell without a folder is created, a folder with another version is bumped, a folder without a cell is deleted', () => {
	const cells = [cell('bare-0.85', '0.85.3'), cell('bare-0.86', '0.86.3'), cell('bare-0.87', '0.87.1')]

	const plan = planGeneration(
		cells,
		new Map([
			['bare-0.84', '0.84.9'],
			['bare-0.86', '0.86.2'],
			['bare-0.87', '0.87.1'],
		]),
	)

	expect(plan.create.map(({ id }) => id)).toEqual(['bare-0.85'])
	expect(plan.bump.map(({ id }) => id)).toEqual(['bare-0.86'])
	expect(plan.remove).toEqual(['bare-0.84'])
})

test('a folder that already pins the cell version is left alone', () => {
	const plan = planGeneration([cell('bare-0.87', '0.87.1')], new Map([['bare-0.87', '0.87.1']]))

	expect(plan).toEqual({ bump: [], create: [], remove: [] })
})

test('the floor example is never deleted, and is not created until its own change adds it', () => {
	const floor = cell('bare-0.81', '0.81.6', 'floor')

	expect(planGeneration([floor], new Map())).toEqual({ bump: [], create: [], remove: [] })
	expect(planGeneration([], new Map([['bare-0.81', '0.81.6']]))).toEqual({ bump: [], create: [], remove: [] })
	expect(planGeneration([floor], new Map([['bare-0.81', '0.81.5']])).bump).toEqual([floor])
})

test('expo cells are not bare examples', () => {
	const expo = { ...cell('expo-57', '0.86.3'), kind: 'expo' }

	expect(planGeneration([expo], new Map())).toEqual({ bump: [], create: [], remove: [] })
})

test('a bump changes react-native and the @react-native packages, and nothing else', () => {
	expect(bumpManifest(templateManifest, '0.86.4')).toEqual({
		...templateManifest,
		dependencies: {
			...templateManifest.dependencies,
			'@react-native/new-app-screen': '0.86.4',
			'react-native': '0.86.4',
		},
		devDependencies: {
			...templateManifest.devDependencies,
			'@react-native/babel-preset': '0.86.4',
			'@react-native/eslint-config': '0.86.4',
			'@react-native/metro-config': '0.86.4',
		},
	})
})

test('the template manifest becomes the example manifest', () => {
	expect(wireManifest(templateManifest, cell('bare-0.86', '0.86.3'))).toEqual({
		dependencies: {
			'@react-native-use-dom/example-app': 'workspace:*',
			react: '19.2.3',
			'react-dom': '19.2.3',
			'react-native': '0.86.3',
			'react-native-nitro-modules': '0.37.1',
			'react-native-safe-area-context': '^5.10.1',
			'react-native-use-dom': 'workspace:*',
		},
		devDependencies: {
			'@react-native-community/cli': '20.1.0',
			'@react-native/babel-preset': '0.86.3',
			'@react-native/codegen': '0.86.3',
			'@react-native/gradle-plugin': '0.86.3',
			'@react-native/metro-config': '0.86.3',
		},
		engines: { node: '>= 22.11.0' },
		name: 'bare-0.86',
		private: true,
		scripts: { android: 'react-native run-android', start: 'react-native start' },
		version: '0.0.1',
	})
})

/** The repository the generator runs against: a temporary copy of what it reads. */
let root = ''

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), 'generate-bare-'))

	mkdirSync(path.join(root, 'e2e', 'example-app', 'public'), { recursive: true })
	writeFileSync(path.join(root, 'e2e', 'example-app', 'use-dom-env.d.ts'), 'declare const env: true\n')
	writeFileSync(path.join(root, 'e2e', 'example-app', 'public', 'atom.svg'), '<svg />\n')
	mkdirSync(path.join(root, 'examples'))
})

afterEach(() => {
	rmSync(root, { force: true, recursive: true })
})

/**
 * Stands in for the template's `init`: a folder with the files the generator touches.
 *
 * @param {import('./matrix.mjs').MatrixCell} created
 */
function fakeInit(created) {
	const folder = path.join(root, created.folder)

	mkdirSync(path.join(folder, 'ios'), { recursive: true })
	mkdirSync(path.join(folder, 'android'))
	mkdirSync(path.join(folder, '__tests__'))
	writeFileSync(path.join(folder, 'App.tsx'), 'export default function App() {}\n')
	writeFileSync(path.join(folder, 'index.js'), "import App from './App'\n")
	writeFileSync(path.join(folder, 'package.json'), JSON.stringify(templateManifest))
}

test('a new folder is wired to the shared example app', () => {
	const created = cell('bare-0.86', '0.86.3')

	generateBare({
		cells: [created],
		root,
		runInit: fakeInit,
	})

	const folder = path.join(root, created.folder)

	expect(existsSync(path.join(folder, 'App.tsx'))).toBe(false)
	expect(existsSync(path.join(folder, '__tests__'))).toBe(false)
	expect(readFileSync(path.join(folder, 'index.js'), 'utf8')).toContain("from '@react-native-use-dom/example-app'")
	expect(readFileSync(path.join(folder, 'babel.config.js'), 'utf8')).toContain('react-native-use-dom/babel')
	expect(readFileSync(path.join(folder, 'metro.config.js'), 'utf8')).toContain('watchFolders: [workspaceRoot]')
	expect(readFileSync(path.join(folder, 'use-dom-env.d.ts'), 'utf8')).toBe('declare const env: true\n')
	expect(readFileSync(path.join(folder, 'public', 'atom.svg'), 'utf8')).toBe('<svg />\n')
	expect(JSON.parse(readFileSync(path.join(folder, 'package.json'), 'utf8')).name).toBe('bare-0.86')
})

test('a second run changes nothing, and a patch release only changes package.json', () => {
	const options = { root, runInit: fakeInit }
	const first = cell('bare-0.86', '0.86.3')
	const second = cell('bare-0.87', '0.87.1')

	generateBare({ ...options, cells: [first, second] })
	writeFileSync(path.join(root, first.folder, 'ios', 'marker'), 'ios\n')
	writeFileSync(path.join(root, first.folder, 'android', 'marker'), 'android\n')

	const before = snapshot(root)

	expect(generateBare({ ...options, cells: [first, second] })).toEqual({ bump: [], create: [], remove: [] })
	expect(snapshot(root)).toEqual(before)

	const patched = cell('bare-0.86', '0.86.4')

	expect(generateBare({ ...options, cells: [patched, second] }).bump).toEqual([patched])

	const after = snapshot(root)
	const changed = [...after.keys()].filter((file) => after.get(file) !== before.get(file))

	expect(changed).toEqual(['examples/bare-0.86/package.json'])

	expect(
		JSON.parse(readFileSync(path.join(root, patched.folder, 'package.json'), 'utf8')).dependencies['react-native'],
	).toBe('0.86.4')
})

test('a folder that left the matrix is deleted, except the floor', () => {
	const options = { root, runInit: fakeInit }

	generateBare({ ...options, cells: [cell('bare-0.84', '0.84.9'), cell('bare-0.81', '0.81.6', 'floor')] })
	mkdirSync(path.join(root, 'examples', 'bare-0.81'))
	writeFileSync(path.join(root, 'examples', 'bare-0.81', 'package.json'), JSON.stringify(templateManifest))

	/** @type {string[]} */
	const logged = []

	generateBare({
		...options,
		cells: [cell('bare-0.86', '0.86.3')],
		log: (message) => {
			logged.push(message)
		},
	})

	expect(readdirSync(path.join(root, 'examples')).sort()).toEqual(['bare-0.81', 'bare-0.86'])
	expect(logged).toContain('deleting examples/bare-0.84: it has no cell in the matrix')
})

/**
 * The content of every file under the root, keyed by its path.
 *
 * @param {string} directory
 * @returns {Map<string, string>}
 */
function snapshot(directory) {
	return new Map(
		readdirSync(directory, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => {
				const file = path.join(entry.parentPath, entry.name)

				return [path.relative(directory, file), readFileSync(file, 'utf8')]
			}),
	)
}
