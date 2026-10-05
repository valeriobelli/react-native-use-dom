import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, expect, test } from '@jest/globals'

import { cell, metadata, templateConfig, templateManifest } from './generate-expo.fixtures.mjs'
import { generateExpo, planGeneration, templateFor } from './generate-expo.mjs'

test('a cell without a folder is created, a folder with another version is bumped, a folder without a cell is deleted', () => {
	const cells = [cell('56', '56.0.23'), cell('57', '57.0.26'), cell('58', '58.0.2')]

	const plan = planGeneration(
		cells,
		new Map([
			['expo-55', '~55.0.1'],
			['expo-57', '~57.0.25'],
			['expo-58', '58.0.2'],
		]),
	)

	expect(plan.create.map(({ id }) => id)).toEqual(['expo-56'])
	expect(plan.bump.map(({ id }) => id)).toEqual(['expo-57'])
	expect(plan.remove).toEqual(['expo-55'])
})

test('a folder whose range starts at the cell version is left alone', () => {
	const plan = planGeneration([cell('57', '57.0.26')], new Map([['expo-57', '~57.0.26']]))

	expect(plan).toEqual({ bump: [], create: [], remove: [] })
})

test('a folder that pins no expo version is bumped', () => {
	expect(planGeneration([cell('57', '57.0.26')], new Map([['expo-57', null]])).bump).toHaveLength(1)
})

test('bare cells are not Expo examples', () => {
	const bare = { ...cell('57', '57.0.26'), kind: 'bare' }

	expect(planGeneration([bare], new Map())).toEqual({ bump: [], create: [], remove: [] })
})

test('the template tag is the SDK, and the exact version for the next SDK', () => {
	expect(templateFor(cell('56', '56.0.23'))).toBe('blank-typescript@sdk-56')
	expect(templateFor(cell('58', '58.0.2', '0.88.0-rc.3', 'Future'))).toBe('blank-typescript@58.0.2')
})

/** The repository the generator runs against: a temporary copy of what it reads. */
let root = ''

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), 'generate-expo-'))

	mkdirSync(path.join(root, 'e2e', 'example-app', 'public'), { recursive: true })
	writeFileSync(path.join(root, 'e2e', 'example-app', 'use-dom-env.d.ts'), 'declare const env: true\n')
	writeFileSync(path.join(root, 'e2e', 'example-app', 'public', 'atom.svg'), '<svg />\n')
	mkdirSync(path.join(root, 'examples'))
})

afterEach(() => {
	rmSync(root, { force: true, recursive: true })
})

/**
 * Stands in for `create-expo-app`: a folder with the files the generator touches.
 *
 * @param {import('./matrix.mjs').MatrixCell} created
 */
function fakeInit(created) {
	const folder = path.join(root, created.folder)

	mkdirSync(path.join(folder, '.git'), { recursive: true })
	mkdirSync(path.join(folder, 'assets'))
	writeFileSync(path.join(folder, 'assets', 'favicon.png'), 'png')
	writeFileSync(path.join(folder, 'App.tsx'), 'export default function App() {}\n')
	writeFileSync(path.join(folder, 'index.ts'), "import App from './App'\n")
	writeFileSync(path.join(folder, '.gitignore'), '/ios\n/android\n')
	writeFileSync(path.join(folder, 'package.json'), JSON.stringify(templateManifest))
	writeFileSync(path.join(folder, 'app.json'), JSON.stringify(templateConfig))
}

/** @param {import('./matrix.mjs').MatrixCell} found */
function readMetadata(found) {
	return metadata(found.id.slice(-2), found.reactNative)
}

test('a new folder is wired to the shared example app', () => {
	const created = cell('56', '56.0.23')

	generateExpo({ cells: [created], readMetadata, root, runInit: fakeInit })

	const folder = path.join(root, created.folder)

	expect(existsSync(path.join(folder, 'App.tsx'))).toBe(false)
	expect(existsSync(path.join(folder, '.git'))).toBe(false)
	expect(existsSync(path.join(folder, 'assets', 'favicon.png'))).toBe(false)
	expect(readFileSync(path.join(folder, '.gitignore'), 'utf8')).toBe('/ios\n/android\n')
	expect(readFileSync(path.join(folder, 'index.ts'), 'utf8')).toContain("from '@react-native-use-dom/example-app'")
	expect(readFileSync(path.join(folder, 'babel.config.js'), 'utf8')).toContain('react-native-use-dom/babel')
	expect(readFileSync(path.join(folder, 'metro.config.js'), 'utf8')).toContain('withDom(config)')
	expect(readFileSync(path.join(folder, 'use-dom-env.d.ts'), 'utf8')).toBe('declare const env: true\n')
	expect(readFileSync(path.join(folder, 'public', 'atom.svg'), 'utf8')).toBe('<svg />\n')
	expect(JSON.parse(readFileSync(path.join(folder, 'package.json'), 'utf8')).dependencies.expo).toBe('56.0.23')

	expect(JSON.parse(readFileSync(path.join(folder, 'app.json'), 'utf8')).expo.ios.bundleIdentifier).toBe(
		'dev.reactnativeusedom.expo56',
	)
})

test('a second run changes nothing, and a patch release only changes package.json', () => {
	const options = { readMetadata, root, runInit: fakeInit }
	const first = cell('56', '56.0.23')
	const second = cell('58', '58.0.2')

	generateExpo({ ...options, cells: [first, second] })

	const before = snapshot(root)

	expect(generateExpo({ ...options, cells: [first, second] })).toEqual({ bump: [], create: [], remove: [] })
	expect(snapshot(root)).toEqual(before)

	const patched = cell('56', '56.0.24')

	expect(generateExpo({ ...options, cells: [patched, second] }).bump).toEqual([patched])

	const after = snapshot(root)
	const changed = [...after.keys()].filter((file) => after.get(file) !== before.get(file))

	expect(changed).toEqual(['examples/expo-56/package.json'])

	expect(JSON.parse(readFileSync(path.join(root, patched.folder, 'package.json'), 'utf8')).dependencies.expo).toBe(
		'56.0.24',
	)
})

test('a folder that left the matrix is deleted', () => {
	const options = { readMetadata, root, runInit: fakeInit }

	generateExpo({ ...options, cells: [cell('55', '55.0.1'), cell('56', '56.0.23')] })
	/** @type {string[]} */
	const logged = []

	generateExpo({
		...options,
		cells: [cell('56', '56.0.23')],
		log: (message) => {
			logged.push(message)
		},
	})

	expect(readdirSync(path.join(root, 'examples'))).toEqual(['expo-56'])
	expect(logged).toContain('deleting examples/expo-55: it has no cell in the matrix')
})

test('an Expo cell without an expo version is refused', () => {
	expect(() =>
		generateExpo({ cells: [{ ...cell('56', '56.0.23'), expo: null }], readMetadata, root, runInit: fakeInit }),
	).toThrow('expo-56 is an Expo cell without an expo version')
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
