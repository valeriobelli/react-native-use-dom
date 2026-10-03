#!/usr/bin/env node

/**
 * Runs one directory of Argent flows: `node scripts/e2e/run.cli.mjs <app> <release|dev> [--device <id>]
 * [--update-baselines]`, which runs `argent flow run .argent/flows/<app>/<kind>`. Every flag after the two
 * arguments goes to `argent flow run` unchanged.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..')
const KINDS = ['release', 'dev']

const [app, kind, ...flags] = process.argv.slice(2)

if (app === undefined || kind === undefined) {
	fail('usage: pnpm e2e <app> <release|dev> [--device <id>] [--update-baselines]')
}

if (!KINDS.includes(kind)) {
	fail(`the kind must be one of ${KINDS.join(', ')}, got "${kind}"`)
}

const directory = path.posix.join('.argent/flows', app, kind)

const result = spawnSync('argent', ['flow', 'run', directory, ...flags], { cwd: REPOSITORY_ROOT, stdio: 'inherit' })

if (result.error !== undefined) {
	fail(`running argent failed: ${result.error.message}`)
}

process.exit(result.status ?? 1)

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
	process.stderr.write(`${message}\n`)
	process.exit(2)
}
