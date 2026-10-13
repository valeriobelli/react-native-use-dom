/// <reference types="node" />

/**
 * Disables the latest OTA bundle of the flow's platform, so the app rolls back to its built-in
 * bundle. Run by the OTA flow's `script:` step.
 *
 * The platform comes from `HOT_UPDATER_PLATFORM` (`ios` or `android`), set by the flow runner. Only
 * that platform's bundle is disabled, so the other platform keeps its update for its own flow.
 *
 * Sources: https://hot-updater.dev/docs/get-started/test-ota (rollback section)
 */
import { execSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..', '..')

const build = process.env.HOT_UPDATER_BUILD
const platform = process.env.HOT_UPDATER_PLATFORM ?? 'android'

if (!build || (build !== 'bare' && build !== 'expo')) {
	throw new Error('HOT_UPDATER_BUILD must be set to "bare" or "expo"')
}

const appDir = build === 'expo' ? 'examples/expo-57' : 'examples/bare-0.87'

// List the bundles and disable the latest enabled one of this platform.
const listOutput = execSync('npx hot-updater bundle list --json', {
	cwd: path.join(root, appDir),
	encoding: 'utf8',
	env: { ...process.env, HOT_UPDATER_ADMIN_TOKEN: 'test-admin' },
})

const bundles = JSON.parse(listOutput) as Array<{ enabled: boolean; id: string; platform: string }>
const latest = bundles.find((bundle) => bundle.enabled && bundle.platform === platform)

if (!latest) {
	process.exit(0)
}

execSync(`npx hot-updater bundle disable ${latest.id}`, {
	cwd: path.join(root, appDir),
	env: { ...process.env, HOT_UPDATER_ADMIN_TOKEN: 'test-admin' },
	stdio: 'inherit',
})
