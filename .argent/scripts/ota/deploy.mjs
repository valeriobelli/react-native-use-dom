/// <reference types="node" />

/**
 * Deploys an OTA update that changes the OTA greeting from "Built-in greeting" to
 * "Updated greeting". Run by the OTA flow's `script:` step.
 *
 * The build plugin and platform are read from `config.json`, which `run.cli.mts` writes before
 * the flow runs (Argent's script runner does not pass custom env vars). The app version is `1.0`
 * to match the native build.
 *
 * Sources: https://hot-updater.dev/docs/get-started/test-ota
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..', '..')

// Argent's script runner only passes a whitelist of env vars, so run.cli.mts writes the build
// and platform to a config file the scripts read.
const config = JSON.parse(readFileSync(path.join(import.meta.dirname, 'config.json'), 'utf8'))
const build = config.build
const platform = config.platform ?? 'android'

if (!build || (build !== 'bare' && build !== 'expo')) {
	throw new Error('config.json must set build to "bare" or "expo"')
}

// The greeting lives in the host app's Root.tsx and the page stamp in the DOM component, so the
// OTA update changes both the bundle and the page's own bytes: an implementation still serving the
// old page fails the flow, even though the prop came from the new bundle.
const appDir = build === 'expo' ? 'examples/expo-57' : 'examples/bare-0.87'
const rootFile = path.join(root, appDir, 'Root.tsx')
const pageFile = path.join(root, 'e2e/ota-app/src/OtaGreeting.tsx')

const rootSource = await readFile(rootFile, 'utf8')
const updatedRoot = rootSource.replace("'Built-in greeting'", "'Updated greeting'")
const pageSource = await readFile(pageFile, 'utf8')
const updatedPage = pageSource.replace("'page a'", "'page b'")

if (updatedRoot === rootSource) {
	throw new Error('Could not find the greeting to change in Root.tsx')
}

if (updatedPage === pageSource) {
	throw new Error('Could not find the page stamp to change in OtaGreeting.tsx')
}

await writeFile(rootFile, updatedRoot)
await writeFile(pageFile, updatedPage)

try {
	// Deploy the update through the Hot Updater CLI for the platform the flow runs on. The config in
	// the app's directory points at the local server.
	const { execSync } = await import('node:child_process')

	const output = execSync(`npx hot-updater deploy -p ${platform} -c production -t 1.0 --force-update`, {
		cwd: path.join(root, appDir),
		encoding: 'utf8',
		env: { ...process.env, HOT_UPDATER_ADMIN_TOKEN: 'test-admin' },
		stdio: ['inherit', 'pipe', 'inherit'],
	})

	// Record the deployed bundle's id, so the rollback disables exactly what this deploy created
	// rather than whichever bundle happens to be enabled when it runs.
	const id = /ID:\s*([0-9a-f-]{36})/u.exec(output)?.[1]

	if (!id) {
		throw new Error(`Could not read the deployed bundle id from the deploy output:\n${output}`)
	}

	await writeFile(path.join(import.meta.dirname, 'config.json'), JSON.stringify({ build, bundleId: id, platform }))

	// #62: the build must have written a page next to the bundle for every DOM component the app
	// renders. The host app bundles the DOM modules of e2e/example-app and e2e/ota-app, so the check
	// enumerates their `'use dom'` modules and requires each one's page — named after the MD5 of the
	// module's absolute path, as `bundle-file.ts` names every page — in the build's dom.bundle.
	const pagesDir = path.join(root, appDir, 'dist', 'dom.bundle')
	const sourceDirs = ['e2e/example-app/src', 'e2e/ota-app/src'].map((dir) => path.join(root, dir))
	const missing = []

	for (const sourceDir of sourceDirs) {
		for (const entry of readdirSync(sourceDir, { recursive: true, withFileTypes: true })) {
			if (!entry.isFile() || !entry.name.endsWith('.tsx')) {
				continue
			}

			const file = path.join(entry.parentPath ?? entry.path, entry.name)

			// Only a module whose first statement is 'use dom' gets a page, exactly as the Babel
			// plugin decides.
			if (!readFileSync(file, 'utf8').startsWith("'use dom'")) {
				continue
			}

			const page = `${createHash('md5').update(file).digest('hex')}.html`

			if (!existsSync(path.join(pagesDir, page))) {
				missing.push(path.relative(root, file))
			}
		}
	}

	if (missing.length > 0) {
		throw new Error(
			`The ${platform} build wrote no page for these DOM components at ${path.relative(root, pagesDir)}:\n` +
				missing.map((name) => `- ${name}`).join('\n'),
		)
	}
} finally {
	// Restore both files, so the next flow run starts from the built-in greeting and page stamp.
	await writeFile(rootFile, rootSource)
	await writeFile(pageFile, pageSource)
}
