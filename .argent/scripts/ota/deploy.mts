/// <reference types="node" />

/**
 * Deploys an OTA update that changes the OTA greeting from "Built-in greeting" to
 * "Updated greeting". Run by the OTA flow's `script:` step.
 *
 * The build plugin and platform are read from environment variables the flow runner sets:
 * `HOT_UPDATER_BUILD` (`bare` or `expo`) and `HOT_UPDATER_PLATFORM` (`ios` or `android`). The app
 * version is `1.0` to match the native build.
 *
 * Sources: https://hot-updater.dev/docs/get-started/test-ota
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..', '..')

const build = process.env.HOT_UPDATER_BUILD
const platform = process.env.HOT_UPDATER_PLATFORM ?? 'android'

if (!build || (build !== 'bare' && build !== 'expo')) {
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
	// Deploy the update through the Hot Updater CLI for the platform the flow runs on. The config in
	// the app's directory points at the local server.
	const { execSync } = await import('node:child_process')

	execSync(`npx hot-updater deploy -p ${platform} -c production -t 1.0 --force-update`, {
		cwd: path.join(root, appDir),
		env: { ...process.env, HOT_UPDATER_ADMIN_TOKEN: 'test-admin' },
		stdio: 'inherit',
	})

	// #62: the build must have written a page next to the bundle for every DOM component the app
	// renders. The OTA screen renders OtaGreeting, whose page is named after the MD5 of its absolute
	// path (as `bundle-file.ts` names every page), so an update without that page is not an update.
	const pagesDir = path.join(root, appDir, 'dist', 'dom.bundle')
	const greetingPage = `${createHash('md5').update(path.join(root, 'e2e/ota-app/src/OtaGreeting.tsx')).digest('hex')}.html`

	if (!existsSync(pagesDir) || !existsSync(path.join(pagesDir, greetingPage))) {
		throw new Error(
			`The ${platform} build wrote no page for the OTA greeting at ${pagesDir}; ` +
				'withDom() wrote no dom.bundle/ next to the bundle',
		)
	}

	const pageCount = readdirSync(pagesDir).filter((file) => file.endsWith('.html')).length

	if (pageCount === 0) {
		throw new Error(`The ${platform} build wrote no DOM pages at ${pagesDir}`)
	}
} finally {
	// Restore the greeting so the next flow run starts from the built-in one.
	await writeFile(rootFile, source)
}
