/**
 * Generates the bare example apps of the e2e matrix. A folder is created once per React Native
 * minor, from the official template for that version, wired to the shared example app, and then
 * edited in place: a patch release only changes the versions in its `package.json`. The decisions
 * about what to create, bump or delete are pure functions, so the tests feed them temporary
 * directories; `generate-bare.cli.mjs` runs the real template and the installs.
 */

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
	BABEL_CONFIG,
	EXAMPLE_APP,
	INDEX,
	METRO_CONFIG,
	readme,
	TEMPLATE_PACKAGES,
	TEMPLATE_PATHS,
	TEMPLATE_SCRIPTS,
	TSCONFIG,
} from './generate-bare.files.mjs'
import { applySceneLifeCycle } from './generate-bare.scene.mjs'

/**
 * The version of the packages every example shares, which `pnpm-workspace.yaml` holds in its default
 * catalog. The generator writes the reference, never the version.
 */
const CATALOG = 'catalog:'

/**
 * The bare cells the generator leaves alone until their own issue adds them: it neither creates
 * nor deletes them.
 */
const DEFERRED_CELLS = new Set(['bare-0.81'])

/** The name of a bare example's folder, under `examples/`. */
const BARE_FOLDER = /^bare-/u

/**
 * @typedef {import('./matrix.mjs').MatrixCell} MatrixCell
 */

/**
 * A `package.json`: the sections the generator reads, and whatever else it carries along.
 *
 * @typedef {{
 *   dependencies?: Record<string, string>,
 *   devDependencies?: Record<string, string>,
 *   scripts?: Record<string, string>,
 *   [key: string]: unknown,
 * }} Manifest
 */

/**
 * What the generator will do to the bare examples.
 *
 * @typedef {object} Plan
 * @property {MatrixCell[]} create the cells whose folder does not exist
 * @property {MatrixCell[]} bump the cells whose folder pins another `react-native` version
 * @property {string[]} remove the bare folders, under `examples/`, that have no cell
 */

/**
 * Decides which bare examples to create, bump or delete.
 *
 * @param {MatrixCell[]} cells the cells of the matrix
 * @param {Map<string, string | null>} folders each existing `examples/bare-*` folder's name mapped to
 * the `react-native` version it pins, or `null` when it pins none
 * @returns {Plan}
 */
export function planGeneration(cells, folders) {
	const bare = cells.filter((cell) => cell.kind === 'bare')
	const ids = new Set(bare.map((cell) => cell.id))

	return {
		bump: bare.filter((cell) => folders.has(cell.id) && folders.get(cell.id) !== cell.reactNative),
		create: bare.filter((cell) => !folders.has(cell.id) && !DEFERRED_CELLS.has(cell.id)),
		remove: [...folders.keys()].filter((name) => !ids.has(name) && !DEFERRED_CELLS.has(name)).sort(),
	}
}

/**
 * Pins a `package.json` to another React Native version: `react-native` and every
 * `@react-native/*` package change, and nothing else.
 *
 * @param {Manifest} manifest
 * @param {string} reactNative
 * @returns {Manifest}
 */
export function bumpManifest(manifest, reactNative) {
	return {
		...manifest,
		...(manifest.dependencies === undefined ? {} : { dependencies: pinPackages(manifest.dependencies, reactNative) }),
		...(manifest.devDependencies === undefined
			? {}
			: { devDependencies: pinPackages(manifest.devDependencies, reactNative) }),
	}
}

/**
 * @param {Record<string, string>} packages
 * @param {string} reactNative
 * @returns {Record<string, string>}
 */
function pinPackages(packages, reactNative) {
	return Object.fromEntries(
		Object.entries(packages).map(([name, version]) => [
			name,
			name === 'react-native' || name.startsWith('@react-native/') ? reactNative : version,
		]),
	)
}

/**
 * Turns the template's `package.json` into the example's: named after the cell, wired to the
 * workspace, and without the template's own tests and tooling.
 *
 * @param {Manifest} template
 * @param {MatrixCell} cell
 * @returns {Manifest}
 */
export function wireManifest(template, cell) {
	const dependencies = template.dependencies ?? {}
	const devDependencies = template.devDependencies ?? {}
	const scripts = template.scripts ?? {}

	return {
		...template,
		dependencies: sortKeys({
			...withoutTemplatePackages(dependencies),
			[EXAMPLE_APP]: 'workspace:*',
			'react-dom': dependencies.react,
			'react-native': cell.reactNative,
			'react-native-nitro-modules': CATALOG,
			'react-native-safe-area-context': CATALOG,
			'react-native-use-dom': 'workspace:*',
		}),
		devDependencies: sortKeys({
			...withoutTemplatePackages(devDependencies),
			// Gradle and the pods resolve these from the app's `node_modules`, where pnpm links only
			// what the app names.
			'@react-native/codegen': cell.reactNative,
			'@react-native/gradle-plugin': cell.reactNative,
		}),
		name: cell.id,
		scripts: Object.fromEntries(Object.entries(scripts).filter(([name]) => !TEMPLATE_SCRIPTS.has(name))),
	}
}

/**
 * @param {Record<string, string>} packages
 * @returns {Record<string, string>}
 */
function withoutTemplatePackages(packages) {
	return Object.fromEntries(Object.entries(packages).filter(([name]) => !TEMPLATE_PACKAGES.has(name)))
}

/**
 * @param {Record<string, string>} record
 * @returns {Record<string, string>}
 */
function sortKeys(record) {
	return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right, 'en')))
}

/**
 * Writes a JSON file the way the repository formats them.
 *
 * @param {string} file
 * @param {unknown} value
 */
function writeJson(file, value) {
	writeFileSync(file, `${JSON.stringify(value, null, '\t')}\n`)
}

/**
 * @param {string} file
 * @returns {Manifest}
 */
function readManifest(file) {
	return (
		/** @type {Manifest} */
		(JSON.parse(readFileSync(file, 'utf8')))
	)
}

/**
 * Reads `react-native` from each `examples/bare-*` folder.
 *
 * @param {string} root the repository root
 * @returns {Map<string, string | null>}
 */
export function readBareFolders(root) {
	const examples = path.join(root, 'examples')

	return new Map(
		readdirSync(examples, { withFileTypes: true })
			.filter((entry) => BARE_FOLDER.test(entry.name) && entry.isDirectory())
			.map((entry) => [entry.name, pinnedReactNative(path.join(examples, entry.name, 'package.json'))]),
	)
}

/**
 * @param {string} manifestFile
 * @returns {string | null} the `react-native` version a `package.json` pins, or `null` when the file
 * is missing or pins none
 */
function pinnedReactNative(manifestFile) {
	try {
		return readManifest(manifestFile).dependencies?.['react-native'] ?? null
	} catch {
		return null
	}
}

/**
 * Runs the template's `init` for a cell, in a folder that does not exist yet.
 *
 * @typedef {(cell: MatrixCell, root: string) => void} RunInit
 */

/**
 * Writes the wiring of a cell's folder, after the template created it.
 *
 * @param {string} root the repository root
 * @param {MatrixCell} cell
 */
export function wireFolder(root, cell) {
	const folder = path.join(root, cell.folder)

	for (const name of TEMPLATE_PATHS) {
		rmSync(path.join(folder, name), { force: true, recursive: true })
	}

	const manifestFile = path.join(folder, 'package.json')

	writeJson(manifestFile, wireManifest(readManifest(manifestFile), cell))

	writeFileSync(path.join(folder, 'babel.config.js'), BABEL_CONFIG)
	writeFileSync(path.join(folder, 'metro.config.js'), METRO_CONFIG)
	writeFileSync(path.join(folder, 'index.js'), INDEX)
	writeFileSync(path.join(folder, 'tsconfig.json'), TSCONFIG)
	writeFileSync(path.join(folder, 'README.md'), readme(cell))

	const exampleApp = path.join(root, 'e2e', 'example-app')

	cpSync(path.join(exampleApp, 'use-dom-env.d.ts'), path.join(folder, 'use-dom-env.d.ts'))
	rmSync(path.join(folder, 'public'), { force: true, recursive: true })
	cpSync(path.join(exampleApp, 'public'), path.join(folder, 'public'), { recursive: true })
}

/**
 * Applies the plan: creates, bumps and deletes the bare examples. Does not install packages or pods,
 * which need the workspace installed first.
 *
 * @param {object} options
 * @param {string} options.root the repository root
 * @param {MatrixCell[]} options.cells the cells of the matrix
 * @param {RunInit} options.runInit creates a cell's folder from the official template
 * @param {import('./generate-bare.scene.mjs').AddToProject} options.addToProject adds a file to an Xcode project
 * @param {(message: string) => void} [options.log]
 * @returns {Plan}
 */
export function generateBare({ addToProject, cells, log = () => {}, root, runInit }) {
	const plan = planGeneration(cells, readBareFolders(root))

	for (const name of plan.remove) {
		log(`deleting examples/${name}: it has no cell in the matrix`)
		rmSync(path.join(root, 'examples', name), { force: true, recursive: true })
	}

	for (const cell of plan.bump) {
		log(`pinning ${cell.folder} to react-native ${cell.reactNative}`)

		const manifestFile = path.join(root, cell.folder, 'package.json')

		writeJson(manifestFile, bumpManifest(readManifest(manifestFile), cell.reactNative))
	}

	for (const cell of plan.create) {
		log(`creating ${cell.folder} from the react-native ${cell.reactNative} template`)
		mkdirSync(path.join(root, 'examples'), { recursive: true })
		runInit(cell, root)
		wireFolder(root, cell)
	}

	for (const cell of cells.filter((candidate) => candidate.kind === 'bare' && !DEFERRED_CELLS.has(candidate.id))) {
		if (applySceneLifeCycle({ addToProject, cell, root })) {
			log(`giving ${cell.folder} the scene life cycle its template lacks`)
		}
	}

	return plan
}
