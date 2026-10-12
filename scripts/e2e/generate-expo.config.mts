/**
 * What the Expo generator writes into an example's `package.json` and `app.json`: pure functions of
 * the template's files, the matrix cell, and what the cell's `expo` version publishes.
 */

import { EXAMPLE_APP, TEMPLATE_PACKAGES } from './generate-expo.files.mts'
import type { MatrixCell } from './matrix.mts'

/**
 * The version of the packages every example shares, which `pnpm-workspace.yaml` holds in its default
 * catalog. The generator writes the reference, never the version.
 */
const CATALOG = 'catalog:'

/** The SDK whose iOS 27 build needs the scene life cycle, which `expo-build-properties` turns on. */
const SCENE_SDK = 57

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
 * What an `expo` version publishes about the versions of its SDK.
 */
export interface ExpoMetadata {
	/** The packages `expo install` pins, from the `bundledNativeModules.json` of the `expo` package. */
	bundledNativeModules: Record<string, string>
	/** The `dependencies` of the `expo` package. */
	dependencies: Record<string, string>
}

/**
 * An `app.json`'s `expo` section: the keys the generator sets, and whatever else it carries along.
 */
export type AppConfig = {
	android?: Record<string, unknown>
	ios?: Record<string, unknown>
	[key: string]: unknown
}

/**
 * The SDK an `expo` version belongs to.
 *
 * @param expo a published `expo` version
 */
export function sdkOf(expo: string): number {
	return Number(expo.split('.')[0])
}

/**
 * Pins a `package.json` to another `expo` version, and nothing else: `expo install --fix` aligns the
 * packages that depend on it.
 *
 * @param manifest the template's `package.json`
 * @param expo the version to pin
 */
export function bumpManifest(manifest: Manifest, expo: string): Manifest {
	return { ...manifest, dependencies: { ...manifest.dependencies, expo } }
}

/**
 * @param versions the versions a source publishes
 * @param name the package whose version is required
 * @param source where the version comes from, for the error
 */
function required(versions: Record<string, string>, name: string, source: string): string {
	const version = versions[name]

	if (version === undefined) {
		throw new Error(`${source} does not list ${name}`)
	}

	return version
}

/**
 * @param record the keys to sort, by locale
 */
function sortKeys(record: Record<string, string>): Record<string, string> {
	return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right, 'en')))
}

/**
 * Turns the template's `package.json` into the example's: named after the cell, wired to the
 * workspace, and with the versions the cell's `expo` version publishes.
 *
 * @param template the template's `package.json`
 * @param cell the cell the folder renders, with the exact `expo` version it pins
 * @param metadata what the cell's `expo` version publishes
 */
export function wireManifest(
	template: Manifest,
	cell: MatrixCell & { expo: string },
	metadata: ExpoMetadata,
): Manifest {
	const source = `expo ${cell.expo}`
	const bundled = metadata.bundledNativeModules
	const reactNative = required(bundled, 'react-native', source)

	if (reactNative !== cell.reactNative) {
		throw new Error(`${source} ships react-native ${reactNative}, but the matrix says ${cell.reactNative}`)
	}

	const templateDependencies = Object.entries(template.dependencies ?? {}).filter(
		([name]) => !TEMPLATE_PACKAGES.has(name),
	)

	return {
		...template,
		dependencies: sortKeys({
			...Object.fromEntries(templateDependencies),
			[EXAMPLE_APP]: 'workspace:*',
			expo: cell.expo,
			react: required(bundled, 'react', source),
			'react-dom': required(bundled, 'react-dom', source),
			'react-native': reactNative,
			'react-native-nitro-modules': CATALOG,
			'react-native-safe-area-context': required(bundled, 'react-native-safe-area-context', source),
			'react-native-use-dom': 'workspace:*',
		}),
		devDependencies: sortKeys({
			...template.devDependencies,
			'babel-preset-expo': required(metadata.dependencies, 'babel-preset-expo', source),
			...(sdkOf(cell.expo) === SCENE_SDK
				? { 'expo-build-properties': required(bundled, 'expo-build-properties', source) }
				: {}),
		}),
		engines: { node: '>=22.12.0' },
		name: cell.id,
		scripts: { android: 'expo run:android', ios: 'expo run:ios', start: 'expo start' },
		version: '0.0.1',
	}
}

/**
 * Turns the template's `app.json` into the example's: named after the cell, with its ids, without
 * the web target, and with the scene life cycle where the SDK needs it.
 *
 * @param template the template's `app.json`
 * @param cell the cell the folder renders, with the exact `expo` version it pins
 */
export function wireAppConfig(
	template: { expo: AppConfig },
	cell: MatrixCell & { expo: string },
): { expo: Record<string, unknown> } {
	const { web: _web, ...config } = template.expo

	return {
		expo: {
			...config,
			android: { ...config.android, package: cell.bundleId },
			ios: { ...config.ios, bundleIdentifier: cell.bundleId },
			name: cell.appName,
			slug: cell.appName,
			...(sdkOf(cell.expo) === SCENE_SDK
				? { plugins: [['expo-build-properties', { ios: { enableSceneSupport: true } }]] }
				: {}),
		},
	}
}
