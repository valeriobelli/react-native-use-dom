#!/usr/bin/env node

/**
 * Updates the local pods of each bare example whose `Podfile.lock` was written for another React
 * Native version, on macOS. `--list` only prints those folders, as a JSON array, on any platform: the
 * matrix update reads it on Linux to decide whether it needs a macOS runner.
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { staleBareFolders, updateStalePods } from './bare-pods.mts'

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..')

try {
	const flags = process.argv.slice(2)
	const unknown = flags.filter((argument) => argument !== '--list')

	if (unknown.length > 0) {
		throw new Error(`unknown option ${unknown.join(' ')}; the only option is --list`)
	}

	// `--list` is the only option the check above lets through.
	const listOnly = flags.length > 0

	if (listOnly) {
		const folders = staleBareFolders({ root: REPOSITORY_ROOT }).map(({ folder }) => folder)

		process.stdout.write(`${JSON.stringify(folders)}\n`)
		process.exit(0)
	}

	if (process.platform !== 'darwin') {
		throw new Error('CocoaPods runs on macOS only')
	}

	// CocoaPods comes from the Gemfile, which a fresh checkout hasn't installed yet.
	if (staleBareFolders({ root: REPOSITORY_ROOT }).length > 0) {
		execFileSync('bundle', ['install'], { cwd: REPOSITORY_ROOT, stdio: 'inherit' })
	}

	const updated = updateStalePods({
		log: (message) => {
			process.stdout.write(`${message}\n`)
		},
		podUpdate: ({ folder, pods }) => {
			execFileSync('bundle', ['exec', 'pod', 'update', '--no-repo-update', ...pods], {
				cwd: path.join(REPOSITORY_ROOT, folder, 'ios'),
				stdio: 'inherit',
			})
		},
		root: REPOSITORY_ROOT,
	})

	// A lock that still names the old version would fail `pod install` in E2E iOS, so it fails here.
	const left = staleBareFolders({ root: REPOSITORY_ROOT }).map(({ folder }) => folder)

	if (left.length > 0) {
		throw new Error(`the pods of ${left.join(', ')} still name another React Native version`)
	}

	if (updated.length === 0) {
		process.stdout.write('every bare example has the pods of the React Native version it pins\n')
	}
} catch (failure) {
	const message = failure instanceof Error ? failure.message : String(failure)

	process.stderr.write(`updating the pods of the bare examples failed: ${message}\n`)
	process.exit(1)
}
