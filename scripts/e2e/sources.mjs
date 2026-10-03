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
 *
 * @typedef {object} CellOverrides
 * @property {string} [appName]
 * @property {{ runner?: string }} [ios]
 */

/**
 * Reads the rows of React Native's support table, the markdown file the releases page renders.
 *
 * @param {string} markdown
 * @returns {{ minor: string, support: string }[]}
 */
export function parseSupportTable(markdown) {
	const rows = markdown.split('\n').filter((line) => line.startsWith('|'))

	if (rows.length < 2) {
		throw new Error('the React Native support table has no rows')
	}

	const header = cellsOf(rows[0])
	const versionColumn = header.indexOf('Version')
	const supportColumn = header.indexOf('Support')

	if (versionColumn === -1 || supportColumn === -1) {
		throw new Error('the React Native support table has no Version or Support column')
	}

	/** @type {{ minor: string, support: string }[]} */
	const supportTable = []

	for (const row of rows.slice(1)) {
		const cells = cellsOf(row)

		// The separator row under the header, which holds no version.
		if (cells.every((cell) => cell === '' || /^-+$/u.test(cell))) {
			continue
		}

		const minor = /^(\d+\.\d+)\.x$/u.exec(cells[versionColumn])?.[1]

		if (minor === undefined) {
			throw new Error(`the support table holds '${cells[versionColumn]}', which is not a React Native minor`)
		}

		const support = cells[supportColumn]

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
 * @param {Record<string, unknown>} parsed
 * @returns {string[]}
 */
export function reactNativeVersions(parsed) {
	const versions = parsed.versions

	if (typeof versions !== 'object' || versions === null) {
		throw new TypeError('the react-native package page holds no versions object')
	}

	return Object.keys(versions)
}

/**
 * Reads a map whose every value must be a string, like the `expo` dist-tags and each `expo`
 * package's bundled `react-native` pins.
 *
 * @param {Record<string, unknown>} parsed
 * @param {string} what the map the error message names
 * @returns {Record<string, string>}
 */
export function stringMap(parsed, what) {
	/** @type {Record<string, string>} */
	const map = {}

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
 * @param {Record<string, unknown>} parsed
 * @returns {string}
 */
export function bundledReactNative(parsed) {
	const reactNative = parsed['react-native']

	if (typeof reactNative !== 'string') {
		throw new TypeError('bundledNativeModules.json holds no react-native version')
	}

	return reactNative
}

/**
 * Reads the overrides, which name the cells whose derived values differ from the defaults.
 *
 * @param {Record<string, unknown>} parsed
 * @returns {Record<string, CellOverrides>}
 */
export function cellOverrides(parsed) {
	/** @type {Record<string, CellOverrides>} */
	const overrides = {}

	for (const [id, entry] of Object.entries(parsed)) {
		if (typeof entry !== 'object' || entry === null) {
			throw new TypeError(`the override for ${id} is not an object`)
		}

		overrides[id] = cellOverride(id, entry)
	}

	return overrides
}

/**
 * Reads one cell's override.
 *
 * @param {string} id
 * @param {Record<string, unknown>} entry
 * @returns {CellOverrides}
 */
function cellOverride(id, entry) {
	/** @type {CellOverrides} */
	const cell = {}

	if (typeof entry.appName === 'string') {
		cell.appName = entry.appName
	}

	if (typeof entry.ios === 'object' && entry.ios !== null) {
		const runner = stringMap(entry.ios, `the ios override of ${id}`).runner

		if (runner !== undefined) {
			cell.ios = { runner }
		}
	}

	return cell
}

/**
 * The cells of a support table row, without the enclosing pipes and with trimmed edges.
 *
 * @param {string} row
 * @returns {string[]}
 */
function cellsOf(row) {
	return row
		.replace(/^\|/u, '')
		.replace(/\|$/u, '')
		.split('|')
		.map((cell) => cell.trim())
}
