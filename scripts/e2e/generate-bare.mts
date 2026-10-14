/**
 * Generates the bare example apps of the e2e matrix. A folder is created once per React Native
 * minor, from the official template for that version, wired to the shared example app, and then
 * edited in place: a patch release only changes the versions in its `package.json`. The decisions
 * about what to create, bump or delete are pure functions, so the tests feed them temporary
 * directories; `generate-bare.cli.mts` runs the real template and the installs.
 */

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { FLOOR_MINOR } from './floor.mts'
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
} from './generate-bare.files.mts'
import { pinHermesCompiler } from './generate-bare.hermes.mts'
import type { AddToProject } from './generate-bare.scene.mts'
import { applySceneLifeCycle } from './generate-bare.scene.mts'
import type { MatrixCell } from './matrix.mts'

/**
 * The version of the packages every example shares, which `pnpm-workspace.yaml` holds in its default
 * catalog. The generator writes the reference, never the version.
 */
const CATALOG = 'catalog:'

/** The bare examples the generator never deletes: the floor of the peer range, even if its cell is dropped. */
const KEPT_FOLDERS = new Set([`bare-${FLOOR_MINOR}`])

/** The name of a bare example's folder, under `examples/`. */
const BARE_FOLDER = /^bare-/u

/**
 * A `package.json`: the sections the generator reads, and whatever else it carries along.
 */
export interface Manifest {
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	scripts?: Record<string, string>
	[key: string]: unknown
}

/**
 * What the generator will do to the bare examples.
 */
export interface Plan {
	/** The cells whose folder pins another `react-native` version. */
	bump: MatrixCell[]
	/** The cells whose folder does not exist. */
	create: MatrixCell[]
	/** The bare folders, under `examples/`, that have no cell. */
	remove: string[]
}

/**
 * Decides which bare examples to create, bump or delete.
 *
 * @param cells the cells of the matrix
 * @param folders each existing `examples/bare-*` folder's name mapped to the `react-native` version
 * it pins, or `null` when it pins none
 */
export function planGeneration(cells: MatrixCell[], folders: Map<string, string | null>): Plan {
	const bare = cells.filter((cell) => cell.kind === 'bare')
	const ids = new Set(bare.map((cell) => cell.id))

	return {
		bump: bare.filter((cell) => folders.has(cell.id) && folders.get(cell.id) !== cell.reactNative),
		create: bare.filter((cell) => !folders.has(cell.id)),
		remove: [...folders.keys()].filter((name) => !ids.has(name) && !KEPT_FOLDERS.has(name)).sort(),
	}
}

/**
 * Pins a `package.json` to another React Native version: `react-native` and every
 * `@react-native/*` package change, and nothing else.
 *
 * @param manifest the template's `package.json`
 * @param reactNative the version to pin
 */
export function bumpManifest(manifest: Manifest, reactNative: string): Manifest {
	return {
		...manifest,
		...(manifest.dependencies === undefined ? {} : { dependencies: pinPackages(manifest.dependencies, reactNative) }),
		...(manifest.devDependencies === undefined
			? {}
			: { devDependencies: pinPackages(manifest.devDependencies, reactNative) }),
	}
}

/**
 * @param packages a `package.json`'s dependencies
 * @param reactNative the version to pin `react-native` and `@react-native/*` to
 */
function pinPackages(packages: Record<string, string>, reactNative: string): Record<string, string> {
	return Object.fromEntries(
		Object.entries(packages).map(([name, version]): [string, string] => [
			name,
			name === 'react-native' || name.startsWith('@react-native/') ? reactNative : version,
		]),
	)
}

/**
 * Turns the template's `package.json` into the example's: named after the cell, wired to the
 * workspace, and without the template's own tests and tooling.
 *
 * @param template the template's `package.json`
 * @param cell the cell the folder renders
 */
export function wireManifest(template: Manifest, cell: MatrixCell): Manifest {
	const dependencies = template.dependencies ?? {}
	const devDependencies = template.devDependencies ?? {}
	const scripts = template.scripts ?? {}

	return {
		...template,
		dependencies: sortKeys({
			...withoutTemplatePackages(dependencies),
			[EXAMPLE_APP]: 'workspace:*',
			'react-dom': dependencies['react']!,
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
 * @param packages a `package.json`'s dependencies
 */
function withoutTemplatePackages(packages: Record<string, string>): Record<string, string> {
	return Object.fromEntries(Object.entries(packages).filter(([name]) => !TEMPLATE_PACKAGES.has(name)))
}

/**
 * @param record the keys to sort, by locale
 */
function sortKeys(record: Record<string, string>): Record<string, string> {
	return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right, 'en')))
}

/**
 * Writes a JSON file the way the repository formats them.
 *
 * @param file the path to write
 * @param value what to serialize
 */
function writeJson(file: string, value: unknown): void {
	writeFileSync(file, `${JSON.stringify(value, null, '\t')}\n`)
}

/**
 * @param file the path of a `package.json`
 */
function readManifest(file: string): Manifest {
	return JSON.parse(readFileSync(file, 'utf8')) as Manifest
}

/**
 * Reads `react-native` from each `examples/bare-*` folder.
 *
 * @param root the repository root
 */
export function readBareFolders(root: string): Map<string, string | null> {
	const examples = path.join(root, 'examples')

	return new Map(
		readdirSync(examples, { withFileTypes: true })
			.filter((entry) => BARE_FOLDER.test(entry.name) && entry.isDirectory())
			.map((entry): [string, string | null] => [
				entry.name,
				pinnedReactNative(path.join(examples, entry.name, 'package.json')),
			]),
	)
}

/**
 * @param manifestFile the path of a `package.json`
 * @returns the `react-native` version a `package.json` pins, or `null` when the file
 * is missing or pins none
 */
function pinnedReactNative(manifestFile: string): string | null {
	try {
		return readManifest(manifestFile).dependencies?.['react-native'] ?? null
	} catch {
		return null
	}
}

/**
 * Runs the template's `init` for a cell, in a folder that does not exist yet.
 */
export type RunInit = (cell: MatrixCell, root: string) => void

/**
 * Writes the wiring of a cell's folder, after the template created it.
 *
 * @param root the repository root
 * @param cell the cell the folder renders
 */
function wireFolder(root: string, cell: MatrixCell): void {
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
 * @param options `root` is the repository root, `cells` are the cells of the matrix, `runInit`
 * creates a cell's folder from the official template, `addToProject` adds a file to an Xcode
 * project, `hermesCompilerOf` reads the `hermes-compiler` version the cell's React Native depends
 * on (or `null` when it depends on none), and `log` reports the plan
 */
export function generateBare({
	addToProject,
	cells,
	hermesCompilerOf,
	log = () => {},
	root,
	runInit,
}: {
	addToProject: AddToProject
	cells: MatrixCell[]
	hermesCompilerOf: (cell: MatrixCell) => string | null
	log?: (message: string) => void
	root: string
	runInit: RunInit
}): Plan {
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

	for (const cell of cells.filter((candidate) => candidate.kind === 'bare')) {
		if (applySceneLifeCycle({ addToProject, cell, root })) {
			log(`giving ${cell.folder} the scene life cycle its template lacks`)
		}

		if (pinHermesCompiler(root, cell, hermesCompilerOf(cell))) {
			log(`pinning hermes-compiler in ${cell.folder} to the version react-native ${cell.reactNative} uses`)
		}
	}

	return plan
}
