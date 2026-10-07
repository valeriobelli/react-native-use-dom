/**
 * The Release build of a bare example compiles its bundle with `hermesc`, which React Native's Gradle
 * plugin looks for in the app's own `node_modules/hermes-compiler`. A pnpm workspace installs
 * `hermes-compiler` next to react-native instead, so each example names it as a dependency: pnpm then
 * links it where the plugin looks, and the template's Gradle files stay as they are.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** The package that holds `hermesc`. */
const HERMES_COMPILER = 'hermes-compiler'

/**
 * Pins the `hermes-compiler` an example's `package.json` names to the one its React Native depends on.
 *
 * @param {string} root the repository root
 * @param {import('./matrix.mjs').MatrixCell} cell
 * @param {string | null} version the `hermes-compiler` version of the cell's React Native, or `null`
 * when that version ships `hermesc` itself and depends on no such package
 * @returns {boolean} whether the file changed
 */
export function pinHermesCompiler(root, cell, version) {
	const file = path.join(root, cell.folder, 'package.json')

	if (!existsSync(file)) {
		return false
	}

	const manifest =
		/** @type {{ devDependencies?: Record<string, string> }} */
		(JSON.parse(readFileSync(file, 'utf8')))

	const { [HERMES_COMPILER]: current, ...others } = manifest.devDependencies ?? {}

	if (current === (version ?? undefined)) {
		return false
	}

	const devDependencies = Object.fromEntries(
		Object.entries(version === null ? others : { ...others, [HERMES_COMPILER]: version }).sort(([left], [right]) =>
			left.localeCompare(right, 'en'),
		),
	)

	writeFileSync(file, `${JSON.stringify({ ...manifest, devDependencies }, null, '\t')}\n`)

	return true
}
