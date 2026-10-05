/**
 * Renders `docs/compatibility.md` from the e2e matrix: one table row per cell. The page lists what
 * is tested, never pass or fail results.
 */

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
 * @param {{ cells: import('./matrix.mjs').MatrixCell[] }} matrix
 * @returns {string}
 */
export function renderCompatibility(matrix) {
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
		'- React Native versions below 0.81 are not supported.',
		'- React Native 0.81 to 0.84 are covered only by the nightly floor check, which runs the oldest supported',
		'  version, 0.81.',
		'',
	].join('\n')
}

/**
 * The Version column of a cell: the React Native minor, or the Expo SDK with its React Native
 * minor.
 *
 * @param {import('./matrix.mjs').MatrixCell} cell
 * @returns {string}
 */
function versionOf(cell) {
	const minor = cell.reactNative.split('.').slice(0, 2).join('.')

	if (cell.kind === 'expo' && cell.expo !== null) {
		return `Expo SDK ${cell.expo.split('.')[0]} (React Native ${minor})`
	}

	return `React Native ${minor}`
}

/**
 * @param {Record<string, string>} labels
 * @param {string} key
 * @param {string} what
 * @param {string} id
 * @returns {string}
 */
function labelOf(labels, key, what, id) {
	if (!Object.hasOwn(labels, key)) {
		throw new Error(`the ${id} cell has the ${what} '${key}', which the compatibility page does not know`)
	}

	return labels[key]
}

/**
 * A Markdown table with aligned columns, in the layout the repository formatter writes, so
 * formatting the page never changes it.
 *
 * @param {string[][]} rows the header row first
 * @returns {string}
 */
function table(rows) {
	const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)))

	/** @param {string[]} cells */
	const line = (cells) => `| ${cells.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`

	return [line(rows[0]), line(widths.map((width) => '-'.repeat(width))), ...rows.slice(1).map((row) => line(row))].join(
		'\n',
	)
}
