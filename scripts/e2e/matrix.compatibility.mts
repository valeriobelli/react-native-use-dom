/**
 * Renders `docs/compatibility.md` from the e2e matrix: one table row per cell. The page lists what
 * is tested, never pass or fail results.
 */

import { FLOOR_MINOR } from './floor.mts'
import type { MatrixCell } from './matrix.mts'

/** The React Native releases overview, which holds the support schedule the levels come from. */
const RELEASES_URL = 'https://reactnative.dev/releases/overview'

/**
 * How the page names each support level of the React Native schedule. A minor still in the future
 * is tested through its release candidate, and the floor is tested even though React Native no
 * longer supports it.
 */
const SUPPORT_LABELS = {
	Active: 'Active',
	'End of Cycle': 'End of Cycle',
	Future: 'Future (release candidate)',
	Unsupported: 'Unsupported by React Native',
}

/** What the Tested column says for each role of a cell. */
const TESTED_LABELS = { blocking: 'every change', floor: 'nightly' }

/**
 * The Markdown page that lists every tested React Native version and Expo SDK.
 *
 * @param matrix the matrix whose cells the page describes
 */
export function renderCompatibility(matrix: { cells: MatrixCell[] }): string {
	const rows = matrix.cells.map((cell) => [
		versionOf(cell),
		labelOf(SUPPORT_LABELS, cell.support, 'support level', cell.id),
		`\`${cell.folder}\``,
		labelOf(TESTED_LABELS, cell.role, 'role', cell.id),
	])

	return [
		'# Compatibility',
		'',
		'`react-native-use-dom` is tested against these React Native versions and Expo SDKs. The table lists what is',
		'tested. It does not show whether the tests pass.',
		'',
		table([['Version', 'Support level', 'Example folder', 'Tested'], ...rows]),
		'',
		'- **Support level** is the level of the React Native version in the',
		`  [React Native releases overview](${RELEASES_URL}).`,
		'- **Example folder** is the app in this repository that runs the tests for that row.',
		'- **Tested** is `every change` for a version tested on every pull request, and `nightly` for a version tested',
		'  once a night.',
		'',
		'## Versions that are not in the table',
		'',
		`- React Native versions below ${FLOOR_MINOR} are not supported.`,
		...untestedNote(matrix),
		'',
	].join('\n')
}

/**
 * The note on the supported minors between the floor and the oldest one the table tests every
 * change, which only exist once React Native stops supporting the floor.
 *
 * @param matrix the matrix whose cells the page describes
 */
function untestedNote(matrix: { cells: MatrixCell[] }): string[] {
	const floor = minorNumber(FLOOR_MINOR)
	const oldest = Math.min(
		...matrix.cells.filter((cell) => cell.role === 'blocking').map((cell) => minorNumber(cell.reactNative)),
	)

	if (oldest - floor < 2) {
		return []
	}

	const untested =
		oldest - floor === 2 ? `React Native 0.${floor + 1} is` : `React Native 0.${floor + 1} to 0.${oldest - 1} are`

	return [`- ${untested} not tested. The nightly floor check runs the oldest supported version,`, `  ${FLOOR_MINOR}.`]
}

/**
 * The minor number of a version, 85 for both `0.85` and `0.85.3`.
 *
 * @param version a React Native version
 */
function minorNumber(version: string): number {
	return Number(version.split('.')[1])
}

/**
 * The Version column of a cell: the React Native minor, or the Expo SDK with its React Native
 * minor.
 *
 * @param cell the matrix cell whose version the row names
 */
function versionOf(cell: MatrixCell): string {
	const minor = cell.reactNative.split('.').slice(0, 2).join('.')

	if (cell.kind === 'expo' && cell.expo !== null) {
		return `Expo SDK ${cell.expo.split('.')[0]} (React Native ${minor})`
	}

	return `React Native ${minor}`
}

/**
 * The label of a key, which the page must know.
 *
 * @param labels the labels of the column
 * @param key the value the cell carries
 * @param what the column the error message names
 * @param id the cell's id, for the error message
 */
function labelOf(labels: Record<string, string>, key: string, what: string, id: string): string {
	if (!Object.hasOwn(labels, key)) {
		throw new Error(`the ${id} cell has the ${what} '${key}', which the compatibility page does not know`)
	}

	return labels[key]!
}

/**
 * A Markdown table with aligned columns, in the layout the repository formatter writes, so
 * formatting the page never changes it.
 *
 * @param rows the header row first
 */
function table(rows: string[][]): string {
	const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => row[column]!.length)))

	const line = (cells: string[]) => `| ${cells.map((cell, column) => cell.padEnd(widths[column]!)).join(' | ')} |`

	return [
		line(rows[0]!),
		line(widths.map((width) => '-'.repeat(width))),
		...rows.slice(1).map((row) => line(row)),
	].join('\n')
}
