/**
 * Builds the e2e matrix: the exact set of example apps the end-to-end tests must cover, derived
 * from the support table and the published versions. Every function here is pure, so the tests
 * feed it saved copies of the sources instead of the network; `matrix.cli.mjs` fetches the real
 * ones and writes the matrix file.
 */

import { parseSupportTable } from './sources.mjs'

// The compatibility page lives in its own file to keep this one small.
export { renderCompatibility } from './matrix.compatibility.mjs'

/** The support levels the matrix tests, besides a Future minor that has a release candidate. */
const TESTED_LEVELS = new Set(['End of Cycle', 'Active'])

/**
 * The oldest React Native version the library's peer range declares. It is always tested, nightly,
 * even once React Native stops listing it as supported.
 */
const FLOOR_MINOR = '0.81'

/**
 * The last Expo SDK that cannot adopt the UIKit scene life cycle, whose iOS cells therefore build
 * with Xcode 26 instead of Xcode 27. Newer SDKs ship the scene life cycle themselves.
 */
const LAST_SCENELESS_SDK = 56

/** The prefix every example app's bundle id carries. */
const BUNDLE_ID_PREFIX = 'dev.reactnativeusedom.'

/**
 * One cell of the matrix: one example app the tests cover.
 *
 * @typedef {object} MatrixCell
 * @property {string} appName the app's registry name, which the generators use
 * @property {string} bundleId the iOS bundle id and the Android applicationId
 * @property {string | null} expo the expo version an Expo cell pins
 * @property {string} folder the example's folder, under `examples/`
 * @property {string} id the cell's id, `bare-0.87` or `expo-57`
 * @property {{ runner: string }} ios the GitHub runner its iOS cell builds on
 * @property {string} kind `bare` or `expo`
 * @property {string} reactNative the react-native version the cell pins
 * @property {string} role `blocking`, or `floor` for the peer-range floor
 * @property {string} slug the id without dashes and dots, `bare087`
 * @property {string} support the support level the React Native schedule gives the minor
 */

/**
 * The sources the matrix is built from, each fetched by the CLI or loaded from a fixture.
 *
 * @typedef {object} MatrixSources
 * @property {string} supportTable the support table, as fetched from the React Native website
 * @property {string[]} rnVersions every version of `react-native` published on npm
 * @property {Record<string, string>} expoTags the `expo` dist-tags, `sdk-<N>` plus `next`
 * @property {Record<string, string>} bundledRn each `expo` version mapped to the
 * `react-native` version its `bundledNativeModules.json` pins
 * @property {Record<string, import('./sources.mjs').CellOverrides>} overrides
 * @property {string} date the day the matrix is generated, `YYYY-MM-DD`
 */

/**
 * The version the matrix pins for a React Native minor: its highest stable release, or its highest
 * release candidate when the minor is still in the future.
 *
 * @param {string} minor
 * @param {string[]} versions
 * @param {{ future?: boolean }} options
 * @returns {string | null}
 */
export function pickVersion(minor, versions, options) {
	const candidates = versions.flatMap((version) => {
		// The stable patch of the minor, `3` for `0.85.3`; the candidate number of its release
		// candidate, `3` for `0.85.0-rc.3`. Nightlies and other prereleases match neither.
		const rest = version.startsWith(`${minor}.`) ? version.slice(minor.length + 1) : null

		if (rest === null) {
			return []
		}

		const stable = options.future === true ? null : /^\d+$/u.exec(rest)
		const candidate = options.future === true ? /^0-rc\.(\d+)$/u.exec(rest) : null

		if (stable !== null) {
			return [Number(stable[0])]
		}

		if (candidate !== null) {
			return [Number(candidate[1])]
		}

		return []
	})

	if (candidates.length === 0) {
		return null
	}

	const highest = Math.max(...candidates)

	return options.future === true ? `${minor}.0-rc.${highest}` : `${minor}.${highest}`
}

/**
 * Builds the e2e matrix from the sources it names.
 *
 * @param {MatrixSources} sources
 * @returns {{ cells: MatrixCell[], generatedAt: string }}
 */
export function buildMatrix(sources) {
	const window = parseSupportTable(sources.supportTable).filter(
		({ minor, support }) =>
			TESTED_LEVELS.has(support) ||
			(support === 'Future' && pickVersion(minor, sources.rnVersions, { future: true }) !== null),
	)

	const supportOf = new Map(window.map(({ minor, support }) => [minor, support]))

	const bare = window
		.map(({ minor, support }) => {
			const reactNative = pickVersion(minor, sources.rnVersions, { future: support === 'Future' })

			if (reactNative === null) {
				throw new Error(`React Native ${minor} is ${support} but has no published version to test`)
			}

			return bareCell(minor, support, reactNative, sources.overrides)
		})
		.sort((left, right) => digitsOf(left.id) - digitsOf(right.id))

	const expo = expoCells(sources, supportOf).sort((left, right) => digitsOf(left.id) - digitsOf(right.id))

	const floorVersion = pickVersion(FLOOR_MINOR, sources.rnVersions, {})

	if (floorVersion === null) {
		throw new Error(`React Native ${FLOOR_MINOR}, the floor of the peer range, has no published version`)
	}

	const floor = {
		...bareCell(FLOOR_MINOR, supportOf.get(FLOOR_MINOR) ?? 'Unsupported', floorVersion, sources.overrides),
		role: 'floor',
	}

	return { cells: [...bare, ...expo, floor], generatedAt: sources.date }
}

/**
 * The Expo cells of the matrix, one per SDK whose React Native minor is in the window. A stable
 * `sdk-<N>` tag wins over `next` pointing at the same SDK: `next` only fills the gap until the
 * stable tag exists.
 *
 * @param {MatrixSources} sources
 * @param {Map<string, string>} supportOf the tested minors, each mapped to its support level
 * @returns {MatrixCell[]}
 */
function expoCells(sources, supportOf) {
	const tags = Object.keys(sources.expoTags)
		.filter((tag) => /^sdk-\d+$/u.test(tag))
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

	if ('next' in sources.expoTags) {
		tags.push('next')
	}

	/** @type {Map<string, MatrixCell>} */
	const cells = new Map()

	for (const tag of tags) {
		const expoVersion = sources.expoTags[tag]
		const reactNative = sources.bundledRn[expoVersion]

		if (reactNative === undefined) {
			throw new Error(`expo@${expoVersion} (${tag}) has no bundled react-native version`)
		}

		const support = supportOf.get(minorOf(reactNative))

		if (support === undefined) {
			continue
		}

		const sdk = expoVersion.split('.')[0]
		const id = `expo-${sdk}`

		if (cells.has(id)) {
			continue
		}

		cells.set(id, {
			appName: sources.overrides[id]?.appName ?? `ExpoExample${sdk}`,
			bundleId: `${BUNDLE_ID_PREFIX}expo${sdk}`,
			expo: expoVersion,
			folder: `examples/${id}`,
			id,
			ios: { runner: iosRunner(id, Number(sdk) <= LAST_SCENELESS_SDK, sources.overrides) },
			kind: 'expo',
			reactNative,
			role: 'blocking',
			slug: `expo${sdk}`,
			support,
		})
	}

	return [...cells.values()]
}

/**
 * A bare example cell, at the version picked for its minor.
 *
 * @param {string} minor
 * @param {string} support
 * @param {string} reactNative
 * @param {Record<string, import('./sources.mjs').CellOverrides>} overrides
 * @returns {MatrixCell}
 */
function bareCell(minor, support, reactNative, overrides) {
	const id = `bare-${minor}`
	const slug = `bare${minor.replaceAll('.', '')}`

	// Bare examples adopt the scene life cycle through the generator's patch, so their cells are
	// never the ones that build with Xcode 26.
	return {
		appName: overrides[id]?.appName ?? `BareExample${minor.replaceAll('.', '')}`,
		bundleId: `${BUNDLE_ID_PREFIX}${slug}`,
		expo: null,
		folder: `examples/${id}`,
		id,
		ios: { runner: iosRunner(id, false, overrides) },
		kind: 'bare',
		reactNative,
		role: 'blocking',
		slug,
		support,
	}
}

/**
 * The runner an iOS cell uses: Xcode 27, unless the cell cannot adopt the UIKit scene life cycle
 * and therefore builds with Xcode 26. Overrides win over both.
 *
 * @param {string} id
 * @param {boolean} sceneless
 * @param {Record<string, import('./sources.mjs').CellOverrides>} overrides
 * @returns {string}
 */
function iosRunner(id, sceneless, overrides) {
	const override = overrides[id]?.ios?.runner

	return override ?? (sceneless ? 'macos-26' : 'xcode-27')
}

/**
 * The minor part of a version, `0.88` for both `0.88.3` and `0.88.0-rc.3`.
 *
 * @param {string} version
 * @returns {string}
 */
function minorOf(version) {
	return version.split('.').slice(0, 2).join('.')
}

/**
 * The number an id sorts by: 87 for `bare-0.87`, 57 for `expo-57`.
 *
 * @param {string} text
 * @returns {number}
 */
function digitsOf(text) {
	return Number(text.replaceAll(/[^\d]/gu, ''))
}
