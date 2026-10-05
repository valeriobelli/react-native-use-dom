/**
 * Generates the Argent wrapper flows of the e2e matrix. A wrapper launches one example app and runs
 * a shared scenario from `.argent/flows/shared/`: the release wrappers live in `<id>/release/`, the
 * dev wrapper in `<id>/dev/`. The generator never touches a `__baselines__/` folder, except to delete
 * it with the whole directory of an app that left the matrix. `generate-flows.cli.mjs` runs it.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * The shared scenarios every cell runs against a release build. Adding a scenario to
 * `.argent/flows/shared/` means adding it here. `ready` is not one of them: the scenarios run it.
 */
export const RELEASE_SCENARIOS = [
	'errors',
	'first-render',
	'native-action',
	'navigation-blocked',
	'prop-change',
	'refs',
	'scroll',
]

/** The shared scenario every cell runs against a dev build, since it needs Metro. */
export const DEV_SCENARIO = 'fast-refresh'

/** The directory, under `.argent/flows/`, that holds the scenarios the wrappers run. */
const SHARED_DIRECTORY = 'shared'

/**
 * @typedef {Pick<import('./matrix.mjs').MatrixCell, 'bundleId' | 'id' | 'slug'>} FlowCell
 */

/**
 * The content of one wrapper: the launch of the app, then the shared scenario.
 *
 * @param {FlowCell} cell
 * @param {string} scenario
 * @returns {string}
 */
export function wrapper(cell, scenario) {
	return `steps:
  - launch: { ios: ${cell.bundleId}, android: ${cell.bundleId} }
  - run: ../../shared/${scenario}
`
}

/**
 * The wrappers of one cell, as paths relative to `.argent/flows/` with their content.
 *
 * @param {FlowCell} cell
 * @returns {Map<string, string>}
 */
export function planCell(cell) {
	/** @type {Map<string, string>} */
	const files = new Map()

	for (const scenario of RELEASE_SCENARIOS) {
		files.set(`${cell.id}/release/${cell.slug}-${scenario}.yaml`, wrapper(cell, scenario))
	}

	files.set(`${cell.id}/dev/${cell.slug}-${DEV_SCENARIO}.yaml`, wrapper(cell, DEV_SCENARIO))

	return files
}

/**
 * Writes the wrappers of every cell under `<root>/.argent/flows/` and deletes the directories of the
 * apps that are not in the matrix. The shared scenarios and any file that is not a directory stay.
 *
 * @param {{ cells: FlowCell[], log?: (message: string) => void, root: string }} options
 * @returns {{ deleted: string[], written: string[] }}
 */
export function generateFlows({ cells, log = () => {}, root }) {
	const flows = path.join(root, '.argent', 'flows')
	const ids = new Set(cells.map((cell) => cell.id))

	mkdirSync(flows, { recursive: true })

	const deleted = readdirSync(flows, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name !== SHARED_DIRECTORY && !ids.has(entry.name))
		.map((entry) => entry.name)
		.sort()

	for (const id of deleted) {
		rmSync(path.join(flows, id), { force: true, recursive: true })
		log(`deleted .argent/flows/${id}`)
	}

	/** @type {string[]} */
	const written = []

	for (const cell of cells) {
		for (const [file, content] of planCell(cell)) {
			mkdirSync(path.dirname(path.join(flows, file)), { recursive: true })
			writeFileSync(path.join(flows, file), content)
			written.push(file)
		}
	}

	log(`wrote ${written.length} wrappers for ${cells.length} apps`)

	return { deleted, written }
}
