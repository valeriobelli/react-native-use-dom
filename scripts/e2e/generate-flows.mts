/**
 * Generates the Argent wrapper flows of the e2e matrix. A wrapper launches one example app and runs
 * a shared scenario from `.argent/flows/shared/`: the release wrappers live in `<id>/release/`, the
 * dev wrapper in `<id>/dev/`. The generator never touches a `__baselines__/` folder, except to delete
 * it with the whole directory of an app that left the matrix. `generate-flows.cli.mts` runs it.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { MatrixCell } from './matrix.mts'

/**
 * The shared scenarios every cell runs against a release build. Adding a scenario to
 * `.argent/flows/shared/` means adding it here. `ready` is not one of them: the scenarios run it.
 */
export const RELEASE_SCENARIOS = [
	'errors',
	'first-render',
	'native-action',
	'navigation-blocked',
	'page-not-found',
	'prop-change',
	'refs',
	'view-options',
]

/** The shared scenario every cell runs against a dev build, since it needs Metro. */
export const DEV_SCENARIO = 'fast-refresh'

/** The shared scenario only OTA cells run, against a release build with a local update server. */
const OTA_SCENARIO = 'ota'

/** The directory, under `.argent/flows/`, that holds the scenarios the wrappers run. */
const SHARED_DIRECTORY = 'shared'

/**
 * One cell's identity, which is all a wrapper needs.
 */
export type FlowCell = Pick<MatrixCell, 'bundleId' | 'id' | 'ota' | 'slug'>

/**
 * The content of one wrapper: the launch of the app, then the shared scenario.
 *
 * @param cell the cell the wrapper launches
 * @param scenario the shared scenario the wrapper runs
 */
function wrapper(cell: FlowCell, scenario: string): string {
	const launch = `steps:
  - launch: { ios: ${cell.bundleId}, android: ${cell.bundleId} }
  - run: ../../shared/${scenario}
`

	if (scenario !== 'navigation-blocked') {
		return launch
	}

	// On iOS the scenario leaves the app behind the browser, and only a flow that knows the bundle id
	// can bring it back: `launch-app` puts a running app in front without terminating it.
	return `${launch}  - when: { platform: ios }
    steps:
      - tool: launch-app
        args: { bundleId: ${cell.bundleId} }
  - run: ../../shared/navigation-reported
`
}

/**
 * The wrappers of one cell, as paths relative to `.argent/flows/` with their content.
 *
 * @param cell the cell whose wrappers are planned
 */
export function planCell(cell: FlowCell): Map<string, string> {
	const files = new Map<string, string>()

	for (const scenario of RELEASE_SCENARIOS) {
		files.set(`${cell.id}/release/${cell.slug}-${scenario}.yaml`, wrapper(cell, scenario))
	}

	files.set(`${cell.id}/dev/${cell.slug}-${DEV_SCENARIO}.yaml`, wrapper(cell, DEV_SCENARIO))

	if (cell.ota) {
		files.set(`${cell.id}/ota/${cell.slug}-${OTA_SCENARIO}.yaml`, wrapper(cell, OTA_SCENARIO))
	}

	return files
}

/**
 * Writes the wrappers of every cell under `<root>/.argent/flows/` and deletes the directories of the
 * apps that are not in the matrix. The shared scenarios and any file that is not a directory stay.
 *
 * @param options `cells` are the cells whose wrappers are written, `root` is the repository root,
 * and `log` reports what was written and deleted
 */
export function generateFlows({
	cells,
	log = () => {},
	root,
}: {
	cells: FlowCell[]
	log?: (message: string) => void
	root: string
}): { deleted: string[]; written: string[] } {
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

	const written: string[] = []

	for (const cell of cells) {
		for (const [file, content] of planCell(cell)) {
			mkdirSync(path.dirname(path.join(flows, file)), { recursive: true })
			writeFileSync(path.join(flows, file), content)
			written.push(file)
		}

		// A cell that no longer runs the OTA scenario keeps no stale ota/ directory.
		if (!cell.ota) {
			const otaDir = path.join(flows, cell.id, 'ota')

			rmSync(otaDir, { force: true, recursive: true })
		}
	}

	log(`wrote ${written.length} wrappers for ${cells.length} apps`)

	return { deleted, written }
}
