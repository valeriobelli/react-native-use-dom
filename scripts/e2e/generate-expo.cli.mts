#!/usr/bin/env node

/**
 * Creates `examples/<id>` for every Expo cell of `e2e/matrix.json` that has no folder yet, pins the
 * folders that exist to the cell's `expo` version, deletes the Expo folders that left the matrix, and
 * installs the workspace. The native folders are not generated: `expo prebuild` does that.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { ExpoMetadata } from './generate-expo.config.mts'
import { generateExpo, planGeneration, readExpoFolders, templateFor } from './generate-expo.mts'
import type { MatrixCell } from './matrix.mts'

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..')

/**
 * @param url the URL to read
 */
async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url)

	if (!response.ok) {
		throw new Error(`${url} answered ${response.status}`)
	}

	return (await response.json()) as unknown
}

/**
 * Reads what an `expo` version publishes, from its package on unpkg.
 *
 * @param expo the `expo` version the cell pins
 */
async function fetchMetadata(expo: string): Promise<ExpoMetadata> {
	const bundledNativeModules = (await fetchJson(`https://unpkg.com/expo@${expo}/bundledNativeModules.json`)) as Record<
		string,
		string
	>

	const manifest = (await fetchJson(`https://unpkg.com/expo@${expo}/package.json`)) as {
		dependencies: Record<string, string>
	}

	return { bundledNativeModules, dependencies: manifest.dependencies }
}

try {
	const unknown = process.argv.slice(2)

	if (unknown.length > 0) {
		throw new Error(`unknown option ${unknown.join(' ')}; the command takes none`)
	}

	const { cells } = JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, 'e2e/matrix.json'), 'utf8')) as {
		cells: MatrixCell[]
	}

	const planned = planGeneration(cells, readExpoFolders(REPOSITORY_ROOT))

	const metadata = new Map<string, ExpoMetadata>()

	await Promise.all(
		planned.create.map(async (cell) => {
			metadata.set(cell.id, await fetchMetadata(String(cell.expo)))
		}),
	)

	const plan = generateExpo({
		cells,
		log: (message) => {
			process.stdout.write(`${message}\n`)
		},
		readMetadata: (cell) => {
			const found = metadata.get(cell.id)

			if (found === undefined) {
				throw new Error(`no metadata was read for ${cell.id}`)
			}

			return found
		},
		root: REPOSITORY_ROOT,
		runInit: (cell, root) => {
			execFileSync(
				'npx',
				[
					'--yes',
					'create-expo-app@latest',
					cell.folder,
					'--template',
					templateFor(cell),
					'--no-install',
					'--no-agents-md',
					'--yes',
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

	// A patch release changes the packages the SDK pins along with `expo`.
	for (const cell of plan.bump) {
		execFileSync('pnpm', ['exec', 'expo', 'install', '--fix'], {
			cwd: path.join(REPOSITORY_ROOT, cell.folder),
			stdio: 'inherit',
		})
	}
} catch (failure) {
	const message = failure instanceof Error ? failure.message : String(failure)

	process.stderr.write(`generating the Expo examples failed: ${message}\n`)
	process.exit(1)
}
