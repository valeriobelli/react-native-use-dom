/**
 * Turns what the sources give into typed data: the support table markdown, the `react-native`
 * package page, the `expo` dist-tags, each `expo` package's bundled `react-native` pin and the
 * overrides file. Every reader throws on a shape it does not recognize, so a source that changed
 * stops the matrix instead of silently producing a wrong one.
 */

/** The support levels a React Native release can carry, as the support table spells them. */
export const SUPPORT_LEVELS = ['Future', 'Active', 'End of Cycle', 'Unsupported']

/**
 * The per-cell overrides, read from `e2e/matrix.overrides.json`: the derived values that differ
 * from the defaults for a cell whose id matches.
 */
export interface CellOverrides {
	appName?: string
	ios?: { runner?: string; xcode?: string }
}

/** One row of React Native's support table: the minor and the support level it carries. */
interface SupportTableRow {
	minor: string
	support: string
}

/**
 * Reads the rows of React Native's support table, the markdown file the releases page renders.
 *
 * @param markdown the support table, as fetched from the React Native website
 */
export function parseSupportTable(markdown: string): SupportTableRow[] {
	const rows = markdown.split('\n').filter((line) => line.startsWith('|'))

	if (rows.length < 2) {
		throw new Error('the React Native support table has no rows')
	}

	const header = cellsOf(rows[0]!)
	const versionColumn = header.indexOf('Version')
	const supportColumn = header.indexOf('Support')

	if (versionColumn === -1 || supportColumn === -1) {
		throw new Error('the React Native support table has no Version or Support column')
	}

	const supportTable: SupportTableRow[] = []

	for (const row of rows.slice(1)) {
		const cells = cellsOf(row)

		// The separator row under the header, which holds no version.
		if (cells.every((cell) => cell === '' || /^-+$/u.test(cell))) {
			continue
		}

		const minor = /^(\d+\.\d+)\.x$/u.exec(cells[versionColumn]!)?.[1]

		if (minor === undefined) {
			throw new Error(`the support table holds '${cells[versionColumn]}', which is not a React Native minor`)
		}

		const support = cells[supportColumn]!

		if (!SUPPORT_LEVELS.includes(support)) {
			throw new Error(`the support table holds '${support}', which is not a known support level`)
		}

		supportTable.push({ minor, support })
	}

	return supportTable
}

/**
 * The published versions of the fetched `react-native` package page.
 *
 * @param parsed the `react-native` package page
 */
export function reactNativeVersions(parsed: Record<string, unknown>): string[] {
	const versions = parsed['versions']

	if (typeof versions !== 'object' || versions === null) {
		throw new TypeError('the react-native package page holds no versions object')
	}

	return Object.keys(versions)
}

/**
 * Reads a map whose every value must be a string, like the `expo` dist-tags and each `expo`
 * package's bundled `react-native` pins.
 *
 * @param parsed the map to read
 * @param what the map the error message names
 */
export function stringMap(parsed: Record<string, unknown>, what: string): Record<string, string> {
	const map: Record<string, string> = {}

	for (const [name, value] of Object.entries(parsed)) {
		if (typeof value !== 'string') {
			throw new TypeError(`${what} holds ${name}, which is not a string`)
		}

		map[name] = value
	}

	return map
}

/**
 * The `react-native` version an `expo` package pins, which every `expo` package ships.
 *
 * @param parsed the `expo` package's `bundledNativeModules.json`
 */
export function bundledReactNative(parsed: Record<string, unknown>): string {
	const reactNative = parsed['react-native']

	if (typeof reactNative !== 'string') {
		throw new TypeError('bundledNativeModules.json holds no react-native version')
	}

	return reactNative
}

/**
 * Reads the overrides, which name the cells whose derived values differ from the defaults.
 *
 * @param parsed `e2e/matrix.overrides.json`
 */
export function cellOverrides(parsed: Record<string, unknown>): Record<string, CellOverrides> {
	const overrides: Record<string, CellOverrides> = {}

	for (const [id, entry] of Object.entries(parsed)) {
		if (typeof entry !== 'object' || entry === null) {
			throw new TypeError(`the override for ${id} is not an object`)
		}

		overrides[id] = cellOverride(id, entry as Record<string, unknown>)
	}

	return overrides
}

/**
 * Reads one cell's override.
 *
 * @param id the cell's id, for the error messages
 * @param entry the override as it was parsed
 */
function cellOverride(id: string, entry: Record<string, unknown>): CellOverrides {
	const cell: CellOverrides = {}

	if (typeof entry['appName'] === 'string') {
		cell.appName = entry['appName']
	}

	if (typeof entry['ios'] === 'object' && entry['ios'] !== null) {
		const { runner, xcode } = stringMap(entry['ios'] as Record<string, unknown>, `the ios override of ${id}`)

		if (runner !== undefined || xcode !== undefined) {
			cell.ios = { ...(runner === undefined ? {} : { runner }), ...(xcode === undefined ? {} : { xcode }) }
		}
	}

	return cell
}

/**
 * The cells of a support table row, without the enclosing pipes and with trimmed edges.
 *
 * @param row one line of the support table
 */
function cellsOf(row: string): string[] {
	return row
		.replace(/^\|/u, '')
		.replace(/\|$/u, '')
		.split('|')
		.map((cell) => cell.trim())
}
