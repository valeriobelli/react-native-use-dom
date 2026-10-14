/**
 * Generates the Expo example apps of the e2e matrix. A folder is created once per SDK, from the
 * official template for that SDK, wired to the shared example app, and then edited in place: a patch
 * release only changes the `expo` version in its `package.json`. Only JavaScript and `app.json` are
 * committed: `expo prebuild` generates the native folders. The decisions about what to create, bump
 * or delete are pure functions, so the tests feed them temporary directories; `generate-expo.cli.mts`
 * runs the real template and the installs.
 */

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { bumpManifest, sdkOf, wireAppConfig, wireManifest } from './generate-expo.config.mts'
import type { AppConfig, ExpoMetadata, Manifest } from './generate-expo.config.mts'
import { BABEL_CONFIG, INDEX, METRO_CONFIG, readme, TEMPLATE_PATHS } from './generate-expo.files.mts'
import type { MatrixCell } from './matrix.mts'

/** The name of an Expo example's folder, under `examples/`. */
const EXPO_FOLDER = /^expo-/u

/**
 * What the generator will do to the Expo examples.
 */
export interface Plan {
	/** The cells whose folder pins another `expo` version. */
	bump: MatrixCell[]
	/** The cells whose folder does not exist. */
	create: MatrixCell[]
	/** The Expo folders, under `examples/`, that have no cell. */
	remove: string[]
}

/**
 * @param range a version, or a range that starts with `~` or `^`
 */
function exactVersion(range: string): string {
	return range.replace(/^[~^]/u, '')
}

/**
 * The template a cell's folder starts from: the `sdk-<N>` tag of `expo-template-blank-typescript`,
 * or, for the cell that tracks the `next` SDK, the exact `expo` version, which the tags of a
 * preview SDK do not pin.
 *
 * @param cell the cell the folder renders
 */
export function templateFor(cell: MatrixCell): string {
	const expo = String(cell.expo)

	return `blank-typescript@${cell.support === 'Future' ? expo : `sdk-${sdkOf(expo)}`}`
}

/**
 * Decides which Expo examples to create, bump or delete.
 *
 * @param cells the cells of the matrix
 * @param folders each existing `examples/expo-*` folder's name mapped to the `expo` version it pins,
 * or `null` when it pins none
 */
export function planGeneration(cells: MatrixCell[], folders: Map<string, string | null>): Plan {
	const expo = cells.filter((cell) => cell.kind === 'expo')
	const ids = new Set(expo.map((cell) => cell.id))

	return {
		bump: expo.filter((cell) => {
			const pinned = folders.get(cell.id)

			return pinned !== undefined && (pinned === null || exactVersion(pinned) !== cell.expo)
		}),
		create: expo.filter((cell) => !folders.has(cell.id)),
		remove: [...folders.keys()].filter((name) => !ids.has(name)).sort(),
	}
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
 * @param file the path of an `app.json`
 */
function readAppConfig(file: string): { expo: AppConfig } {
	return JSON.parse(readFileSync(file, 'utf8')) as { expo: AppConfig }
}

/**
 * Reads `expo` from each `examples/expo-*` folder.
 *
 * @param root the repository root
 */
export function readExpoFolders(root: string): Map<string, string | null> {
	const examples = path.join(root, 'examples')

	return new Map(
		readdirSync(examples, { withFileTypes: true })
			.filter((entry) => EXPO_FOLDER.test(entry.name) && entry.isDirectory())
			.map((entry): [string, string | null] => [
				entry.name,
				pinnedExpo(path.join(examples, entry.name, 'package.json')),
			]),
	)
}

/**
 * @param manifestFile the path of a `package.json`
 * @returns the `expo` version a `package.json` pins, or `null` when the file is
 * missing or pins none
 */
function pinnedExpo(manifestFile: string): string | null {
	try {
		return readManifest(manifestFile).dependencies?.['expo'] ?? null
	} catch {
		return null
	}
}

/**
 * Runs `create-expo-app` for a cell, without installing, in a folder that does not exist yet.
 */
export type RunInit = (cell: MatrixCell, root: string) => void

/**
 * Writes the wiring of a cell's folder, after the template created it.
 *
 * @param root the repository root
 * @param cell the cell the folder renders, with the exact `expo` version it pins
 * @param metadata what the cell's `expo` version publishes
 */
function wireFolder(root: string, cell: MatrixCell & { expo: string }, metadata: ExpoMetadata): void {
	const folder = path.join(root, cell.folder)

	for (const name of TEMPLATE_PATHS) {
		rmSync(path.join(folder, name), { force: true, recursive: true })
	}

	const manifestFile = path.join(folder, 'package.json')
	const configFile = path.join(folder, 'app.json')

	writeJson(manifestFile, wireManifest(readManifest(manifestFile), cell, metadata))
	writeJson(configFile, wireAppConfig(readAppConfig(configFile), cell))

	writeFileSync(path.join(folder, 'babel.config.js'), BABEL_CONFIG)
	writeFileSync(path.join(folder, 'metro.config.js'), METRO_CONFIG)
	writeFileSync(path.join(folder, 'index.ts'), INDEX)
	writeFileSync(path.join(folder, 'README.md'), readme(cell))

	const exampleApp = path.join(root, 'e2e', 'example-app')

	cpSync(path.join(exampleApp, 'use-dom-env.d.ts'), path.join(folder, 'use-dom-env.d.ts'))
	rmSync(path.join(folder, 'public'), { force: true, recursive: true })
	cpSync(path.join(exampleApp, 'public'), path.join(folder, 'public'), { recursive: true })
}

/**
 * Applies the plan: creates, bumps and deletes the Expo examples. Does not install packages, which
 * need the workspace installed first.
 *
 * @param options `root` is the repository root, `cells` are the cells of the matrix, `runInit`
 * creates a cell's folder from the official template, `readMetadata` reads what a cell's `expo`
 * version publishes, and `log` reports the plan
 */
export function generateExpo({
	cells,
	log = () => {},
	readMetadata,
	root,
	runInit,
}: {
	cells: MatrixCell[]
	log?: (message: string) => void
	readMetadata: (cell: MatrixCell) => ExpoMetadata
	root: string
	runInit: RunInit
}): Plan {
	for (const cell of cells) {
		if (cell.kind === 'expo' && cell.expo === null) {
			throw new Error(`${cell.id} is an Expo cell without an expo version`)
		}
	}

	const plan = planGeneration(cells, readExpoFolders(root))

	for (const name of plan.remove) {
		log(`deleting examples/${name}: it has no cell in the matrix`)
		rmSync(path.join(root, 'examples', name), { force: true, recursive: true })
	}

	for (const cell of plan.bump) {
		log(`pinning ${cell.folder} to expo ${cell.expo}`)

		const manifestFile = path.join(root, cell.folder, 'package.json')

		writeJson(manifestFile, bumpManifest(readManifest(manifestFile), String(cell.expo)))
	}

	for (const cell of plan.create) {
		log(`creating ${cell.folder} from the expo ${cell.expo} template`)
		mkdirSync(path.join(root, 'examples'), { recursive: true })
		runInit(cell, root)
		wireFolder(root, { ...cell, expo: String(cell.expo) }, readMetadata(cell))
	}

	return plan
}
