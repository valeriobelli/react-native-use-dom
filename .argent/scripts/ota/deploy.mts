/// <reference types="node" />

/**
 * Deploys an OTA update that changes the OTA greeting from "Built-in greeting" to
 * "Updated greeting". Run by the OTA flow's `script:` step.
 *
 * The build plugin is read from `HOT_UPDATER_BUILD` (`bare` or `expo`). The app version is `1.0`
 * to match the native build.
 *
 * Sources: https://hot-updater.dev/docs/get-started/test-ota
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..', '..')

const build = process.env.HOT_UPDATER_BUILD

if (!build) {
	throw new Error('HOT_UPDATER_BUILD must be set to "bare" or "expo"')
}

// The greeting lives in the host app's Root.tsx, so the OTA update changes it in the bundle.
const appDir = build === 'expo' ? 'examples/expo-57' : 'examples/bare-0.87'
const rootFile = path.join(root, appDir, 'Root.tsx')

const source = await readFile(rootFile, 'utf8')
const updated = source.replace("'Built-in greeting'", "'Updated greeting'")

if (updated === source) {
	throw new Error('Could not find the greeting to change in Root.tsx')
}

await writeFile(rootFile, updated)

try {
	// Deploy the update through the Hot Updater CLI for both platforms. The config in the app's
	// directory points at the local server.
	const { execSync } = await import('node:child_process')

	for (const p of ['ios', 'android']) {
		execSync(`npx hot-updater deploy -p ${p} -c production -t 1.0 --force-update`, {
			cwd: path.join(root, appDir),
			env: { ...process.env, HOT_UPDATER_ADMIN_TOKEN: 'test-admin' },
			stdio: 'inherit',
		})
	}
} finally {
	// Restore the greeting so the next flow run starts from the built-in one.
	await writeFile(rootFile, source)
}
