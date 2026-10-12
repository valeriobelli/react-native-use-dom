#!/usr/bin/env node

/**
 * Creates `examples/<id>` for every bare cell of `e2e/matrix.json` that has no folder yet, pins the
 * folders that exist to the cell's React Native version, deletes the bare folders that left the
 * matrix, and installs the workspace. On macOS it then installs the pods of each new `ios/` folder,
 * and updates those of each bumped one with `bare-pods.cli.mts`; `--no-pods` skips both.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { generateBare } from './generate-bare.mts'
import type { MatrixCell } from './matrix.mts'

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..')

try {
	const flags = process.argv.slice(2)
	const unknown = flags.filter((argument) => argument !== '--no-pods')

	if (unknown.length > 0) {
		throw new Error(`unknown option ${unknown.join(' ')}; the only option is --no-pods`)
	}

	const installPods = process.platform === 'darwin' && flags.filter((argument) => argument === '--no-pods').length === 0

	const { cells } = JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, 'e2e/matrix.json'), 'utf8')) as {
		cells: MatrixCell[]
	}

	const plan = generateBare({
		addToProject: (project, target) => {
			execFileSync('bundle', ['exec', 'ruby', 'scripts/e2e/add-scene-delegate.rb', project, target], {
				cwd: REPOSITORY_ROOT,
				stdio: 'inherit',
			})
		},
		cells,
		hermesCompilerOf: (cell) => {
			const version = execFileSync(
				'npm',
				['view', `react-native@${cell.reactNative}`, 'dependencies.hermes-compiler'],
				{
					cwd: REPOSITORY_ROOT,
					encoding: 'utf8',
				},
			).trim()

			return version === '' ? null : version
		},
		log: (message) => {
			process.stdout.write(`${message}\n`)
		},
		root: REPOSITORY_ROOT,
		runInit: (cell, root) => {
			execFileSync(
				'npx',
				[
					'--yes',
					'@react-native-community/cli@latest',
					'init',
					cell.appName,
					'--version',
					cell.reactNative,
					'--directory',
					cell.folder,
					'--package-name',
					cell.bundleId,
					'--skip-install',
					'--install-pods',
					'false',
					// The example lives in this repository: a repository of its own inside it would hide it.
					'--skip-git-init',
					'true',
				],
				{ cwd: root, stdio: 'inherit' },
			)
		},
	})

	// The template's JSON is not formatted the way this repository formats it.
	for (const cell of plan.create) {
		execFileSync('pnpm', ['exec', 'oxfmt', cell.folder], { cwd: REPOSITORY_ROOT, stdio: 'inherit' })
	}

	execFileSync('pnpm', ['install'], { cwd: REPOSITORY_ROOT, stdio: 'inherit' })

	// The Podfile resolves react-native from node_modules, so the pods come after the install.
	if (installPods) {
		for (const cell of plan.create) {
			const folder = path.join(REPOSITORY_ROOT, cell.folder)

			execFileSync('bundle', ['install'], { cwd: folder, stdio: 'inherit' })
			execFileSync('bundle', ['exec', 'pod', 'install'], { cwd: path.join(folder, 'ios'), stdio: 'inherit' })
		}

		// A bumped folder keeps the lock of its old version, which `pod install` refuses.
		execFileSync('node', ['scripts/e2e/bare-pods.cli.mts'], { cwd: REPOSITORY_ROOT, stdio: 'inherit' })
	}
} catch (failure) {
	const message = failure instanceof Error ? failure.message : String(failure)

	process.stderr.write(`generating the bare examples failed: ${message}\n`)
	process.exit(1)
}
