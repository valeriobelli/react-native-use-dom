/// <reference types="node" />

/**
 * Disables the bundle the deploy script deployed, so the app rolls back to its built-in bundle.
 * Run by the OTA flow's `script:` step.
 *
 * The bundle id comes from `config.json`, which the deploy script updates after deploying (and
 * which `run.cli.mts` creates with the build and platform before the flow runs). Disabling exactly
 * the deployed id keeps the rollback correct even when older bundles are still enabled.
 *
 * Sources: https://hot-updater.dev/docs/get-started/test-ota (rollback section)
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..', '..')

const config = JSON.parse(readFileSync(path.join(import.meta.dirname, 'config.json'), 'utf8'))
const build = config.build
const bundleId = config.bundleId

if (!build || (build !== 'bare' && build !== 'expo')) {
	throw new Error('config.json must set build to "bare" or "expo"')
}

if (!bundleId) {
	throw new Error('config.json must set bundleId, which the deploy script writes after deploying')
}

const appDir = build === 'expo' ? 'examples/expo-57' : 'examples/bare-0.87'

execSync(`npx hot-updater bundle disable ${bundleId} -y`, {
	cwd: path.join(root, appDir),
	env: { ...process.env, HOT_UPDATER_ADMIN_TOKEN: 'test-admin' },
	stdio: 'inherit',
})
