/**
 * The Release build of a bare example needs to be told where `hermesc` is: a pnpm workspace installs
 * `hermes-compiler` next to react-native, not where the template's Gradle plugin looks for it.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** The line the template leaves commented out, which the next one replaces. */
const HERMES_COMMAND_TEMPLATE = '    // hermesCommand = "$rootDir/my-custom-hermesc/bin/hermesc"\n'

/** Tells where `hermesc` is, which a pnpm workspace does not put where React Native looks for it. */
const HERMES_COMMAND = `${HERMES_COMMAND_TEMPLATE}    //   pnpm installs hermes-compiler next to react-native rather than in the app's node_modules,
    //   where React Native looks for it.
    hermesCommand = new File(["node", "--print", "require.resolve('hermes-compiler/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParent() + "/hermesc/%OS-BIN%/hermesc"
`

/**
 * Points the Release build of a cell at the `hermesc` that pnpm installed. Without it the bundle
 * task fails with "Couldn't determine Hermesc location".
 *
 * @param {string} root the repository root
 * @param {import('./matrix.mjs').MatrixCell} cell
 * @returns {boolean} whether the file changed
 */
export function applyHermesCommand(root, cell) {
	const file = path.join(root, cell.folder, 'android', 'app', 'build.gradle')

	if (!existsSync(file)) {
		return false
	}

	const gradle = readFileSync(file, 'utf8')

	if (gradle.includes('hermesCommand = new File') || !gradle.includes(HERMES_COMMAND_TEMPLATE)) {
		return false
	}

	writeFileSync(file, gradle.replace(HERMES_COMMAND_TEMPLATE, HERMES_COMMAND))

	return true
}
