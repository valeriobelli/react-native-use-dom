#!/usr/bin/env node

/**
 * Runs one directory of Argent flows: `node scripts/e2e/run.cli.mts <app> <release|dev|ota>
 * [--device <id>] [--update-baselines]`, which runs `argent flow run .argent/flows/<app>/<kind>`.
 * Every flag after the two arguments goes to `argent flow run` unchanged.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..')
const KINDS = ['release', 'dev', 'ota']

const [app, kind, ...flags] = process.argv.slice(2)

if (app === undefined || kind === undefined) {
	fail('usage: pnpm e2e <app> <release|dev|ota> [--device <id>] [--update-baselines]')
}

if (!KINDS.includes(kind)) {
	fail(`the kind must be one of ${KINDS.join(', ')}, got "${kind}"`)
}

const directory = path.posix.join('.argent/flows', app, kind)

// The OTA scripts read these to pick the build plugin and platform. The app id encodes the build
// (bare or expo), and the device id encodes the platform: Android devices are emulator-<port>.
const build = app.startsWith('expo') ? 'expo' : 'bare'
const deviceIndex = flags.indexOf('--device')
const device = deviceIndex === -1 ? undefined : flags[deviceIndex + 1]
const platform = device?.startsWith('emulator-') ? 'android' : 'ios'

// Argent's script runner only passes a whitelist of env vars to `script:` steps, so the OTA
// scripts read a config file the CLI writes here instead of env vars.
const configPath = path.join(REPOSITORY_ROOT, '.argent', 'scripts', 'ota', 'config.json')
const fs = await import('node:fs')

await fs.promises.writeFile(configPath, JSON.stringify({ build, platform }))

const result = spawnSync('argent', ['flow', 'run', directory, ...flags], {
	cwd: REPOSITORY_ROOT,
	stdio: 'inherit',
})

if (result.error !== undefined) {
	fail(`running argent failed: ${result.error.message}`)
}

process.exit(result.status ?? 1)

/**
 * @param message the reason, printed on the standard error
 */
function fail(message: string): never {
	process.stderr.write(`${message}\n`)
	process.exit(2)
}
