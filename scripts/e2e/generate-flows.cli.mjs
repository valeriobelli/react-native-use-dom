#!/usr/bin/env node

/**
 * Writes the release and dev wrapper flows of every cell of `e2e/matrix.json` under `.argent/flows/`,
 * and deletes the directories of the apps that are no longer in the matrix.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { generateFlows } from './generate-flows.mjs'

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..')

try {
	const { cells } =
		/** @type {{ cells: import('./matrix.mjs').MatrixCell[] }} */
		(JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, 'e2e/matrix.json'), 'utf8')))

	generateFlows({
		cells,
		log: (message) => {
			process.stdout.write(`${message}\n`)
		},
		root: REPOSITORY_ROOT,
	})
} catch (failure) {
	const message = failure instanceof Error ? failure.message : String(failure)

	process.stderr.write(`generating the flows failed: ${message}\n`)
	process.exit(1)
}
