// oxlint-disable max-lines: the matrix builder is one cohesive module max-lines
/**
 * Builds the e2e matrix: the exact set of example apps the end-to-end tests must cover, derived
 * from the support table and the published versions. Every function here is pure, so the tests
 * feed it saved copies of the sources instead of the network; `matrix.cli.mts` fetches the real
 * ones and writes the matrix file.
 */

import { FLOOR_MINOR } from './floor.mts'
import { parseSupportTable } from './sources.mts'
import type { CellOverrides } from './sources.mts'

// The compatibility page lives in its own file to keep this one small.
export { renderCompatibility } from './matrix.compatibility.mts'

/** The support levels the matrix tests, besides a Future minor that has a release candidate. */
const TESTED_LEVELS = new Set(['End of Cycle', 'Active'])

/**
 * The last Expo SDK that cannot adopt the UIKit scene life cycle, whose iOS cells therefore build
 * with Xcode 26 instead of Xcode 27. Newer SDKs ship the scene life cycle themselves.
 */
const LAST_SCENELESS_SDK = 56

/**
 * The Xcode each runner's cells select. A runner image changes its default Xcode, and adds simulator
 * runtimes, on its own schedule: an xcode-27 image that added iOS 27.1, which creates only the iPhone
 * Duo, broke every cell (https://github.com/actions/runner-images/issues/15000). The workflow boots the
 * runtime of the selected Xcode's SDK, so this also pins the simulator.
 */
const RUNNER_XCODE: Record<string, string> = { 'macos-26': '26.6', 'xcode-27': '27.0' }

/** The prefix every example app's bundle id carries. */
const BUNDLE_ID_PREFIX = 'dev.reactnativeusedom.'

/**
 * One cell of the matrix: one example app the tests cover.
 */
export interface MatrixCell {
	/** The app's registry name, which the generators use. */
	appName: string
	/** The iOS bundle id and the Android applicationId. */
	bundleId: string
	/** The expo version an Expo cell pins. */
	expo: string | null
	/** The example's folder, under `examples/`. */
	folder: string
	/** The cell's id, `bare-0.87` or `expo-57`. */
	id: string
	/**
	 * The GitHub runner its iOS cell builds on, the Xcode version it selects there, and whether a failure of the iOS cell leaves the merge
	 * unblocked, for a cell whose runner fails it for reasons of its own.
	 */
	ios: { allowFailure?: boolean; runner: string; xcode: string }
	/** `bare` or `expo`. */
	kind: string
	/** The react-native version the cell pins. */
	reactNative: string
	/** `blocking`, or `floor` for the peer-range floor. */
	role: string
	/** The id without dashes and dots, `bare087`. */
	slug: string
	/** The support level the React Native schedule gives the minor. */
	support: string
	/**
	 * Whether the OTA end-to-end scenario runs on this cell: the newest stable cell of each kind.
	 * Derived by `buildMatrix`, never set by hand.
	 */
	ota: boolean
}

/**
 * The sources the matrix is built from, each fetched by the CLI or loaded from a fixture.
 */
export interface MatrixSources {
	/** Each `expo` version mapped to the `react-native` version its `bundledNativeModules.json` pins. */
	bundledRn: Record<string, string>
	/** The day the matrix is generated, `YYYY-MM-DD`. */
	date: string
	/** The `expo` dist-tags, `sdk-<N>` plus `next`. */
	expoTags: Record<string, string>
	/** The per-cell overrides, read from `e2e/matrix.overrides.json`. */
	overrides: Record<string, CellOverrides>
	/** Every version of `react-native` published on npm. */
	rnVersions: string[]
	/** The support table, as fetched from the React Native website. */
	supportTable: string
}

/**
 * The version the matrix pins for a React Native minor: its highest stable release, or its highest
 * release candidate when the minor is still in the future.
 *
 * @param minor the React Native minor, `0.85`
 * @param versions every published version of `react-native`
 * @param options `future` when the minor is still ahead of its stable release
 */
export function pickVersion(minor: string, versions: string[], options: { future?: boolean }): string | null {
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
 * @param sources the support table and the published versions
 */
export function buildMatrix(sources: MatrixSources): { cells: MatrixCell[]; generatedAt: string } {
	const window = parseSupportTable(sources.supportTable).filter(
		({ minor, support }) =>
			TESTED_LEVELS.has(support) ||
			(support === 'Future' && pickVersion(minor, sources.rnVersions, { future: true }) !== null),
	)

	const supportOf = new Map(window.map(({ minor, support }): [string, string] => [minor, support]))

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

	const cells = [...bare, ...expo, ...floorCells(sources, supportOf)]

	markOtaCells({ cells })

	return { cells, generatedAt: sources.date }
}

/**
 * The floor cell, once React Native no longer supports the floor. While the window holds the floor
 * there is none, since its blocking cell already tests it.
 *
 * @param sources the support table and the published versions
 * @param supportOf the tested minors, each mapped to its support level
 */
function floorCells(sources: MatrixSources, supportOf: Map<string, string>): MatrixCell[] {
	if (supportOf.has(FLOOR_MINOR)) {
		return []
	}

	const floorVersion = pickVersion(FLOOR_MINOR, sources.rnVersions, {})

	if (floorVersion === null) {
		throw new Error(`React Native ${FLOOR_MINOR}, the floor of the peer range, has no published version`)
	}

	return [{ ...bareCell(FLOOR_MINOR, 'Unsupported', floorVersion, sources.overrides), role: 'floor' }]
}

/**
 * The newest stable cell of each kind — the highest bare cell and the highest Expo cell whose support
 * level is not `Future` — runs the OTA end-to-end scenario. Derived from the matrix, never set by hand:
 * when the matrix rolls, the host moves to the next stable cell automatically.
 *
 * @param options `cells` are the cells of the matrix, sorted by version within each kind
 */
function markOtaCells({ cells }: { cells: MatrixCell[] }): void {
	for (const kind of ['bare', 'expo'] as const) {
		const stable = cells.filter((cell) => cell.kind === kind && cell.role === 'blocking' && cell.support !== 'Future')

		if (stable.length > 0) {
			stable.at(-1)!.ota = true
		}
	}
}

/**
 * The Expo cells of the matrix, one per SDK whose React Native minor is in the window. A stable
 * `sdk-<N>` tag wins over `next` pointing at the same SDK: `next` only fills the gap until the
 * stable tag exists.
 *
 * @param sources the support table and the published versions
 * @param supportOf the tested minors, each mapped to its support level
 */
function expoCells(sources: MatrixSources, supportOf: Map<string, string>): MatrixCell[] {
	const tags = Object.keys(sources.expoTags)
		.filter((tag) => /^sdk-\d+$/u.test(tag))
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

	if ('next' in sources.expoTags) {
		tags.push('next')
	}

	const cells = new Map<string, MatrixCell>()

	for (const tag of tags) {
		const expoVersion = sources.expoTags[tag]!
		const reactNative = sources.bundledRn[expoVersion]

		if (reactNative === undefined) {
			throw new Error(`expo@${expoVersion} (${tag}) has no bundled react-native version`)
		}

		const support = supportOf.get(minorOf(reactNative))

		if (support === undefined) {
			continue
		}

		const sdk = expoVersion.split('.')[0]!
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
			ios: iosCell(id, Number(sdk) <= LAST_SCENELESS_SDK, sources.overrides),
			kind: 'expo',
			ota: false,
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
 * @param minor the React Native minor, `0.85`
 * @param support the support level the React Native schedule gives the minor
 * @param reactNative the react-native version the cell pins
 * @param overrides the per-cell overrides
 */
function bareCell(
	minor: string,
	support: string,
	reactNative: string,
	overrides: Record<string, CellOverrides>,
): MatrixCell {
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
		ios: iosCell(id, false, overrides),
		kind: 'bare',
		ota: false,
		reactNative,
		role: 'blocking',
		slug,
		support,
	}
}

/**
 * How an iOS cell builds: the runner, Xcode 27 unless the cell cannot adopt the UIKit scene life
 * cycle and therefore builds with Xcode 26, and the Xcode version to select on it, the one pinned for
 * the runner. Overrides win over both, and only an override lets the cell fail without blocking a
 * merge.
 *
 * @param id the cell's id, for the overrides
 * @param sceneless whether the cell's SDK cannot adopt the UIKit scene life cycle
 * @param overrides the per-cell overrides
 */
function iosCell(
	id: string,
	sceneless: boolean,
	overrides: Record<string, CellOverrides>,
): { allowFailure?: boolean; runner: string; xcode: string } {
	const override = overrides[id]?.ios
	const runner = override?.runner ?? (sceneless ? 'macos-26' : 'xcode-27')
	const xcode = override?.xcode ?? RUNNER_XCODE[runner]

	if (!xcode) {
		throw new Error(`${id} builds on ${runner}, which has no pinned Xcode: add one to its ios override.`)
	}

	return {
		...(override?.allowFailure ? { allowFailure: true } : {}),
		runner,
		xcode,
	}
}

/**
 * The minor part of a version, `0.88` for both `0.88.3` and `0.88.0-rc.3`.
 *
 * @param version a published version of `react-native`
 */
function minorOf(version: string): string {
	return version.split('.').slice(0, 2).join('.')
}

/**
 * The number an id sorts by: 87 for `bare-0.87`, 57 for `expo-57`.
 *
 * @param text a cell's id
 */
function digitsOf(text: string): number {
	return Number(text.replaceAll(/[^\d]/gu, ''))
}
