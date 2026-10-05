#!/usr/bin/env node

/**
 * Writes `e2e/matrix.json`, and the `docs/compatibility.md` page rendered from it, from the published sources: React Native's support table, the
 * `react-native` versions on npm, the `expo` dist-tags and each `expo` version's bundled
 * `react-native` pin. Any fetch or parse failure exits non-zero and writes nothing, so a partial
 * matrix can never reach a pull request.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { buildMatrix, renderCompatibility } from './matrix.mjs'
import { bundledReactNative, cellOverrides, reactNativeVersions, stringMap } from './sources.mjs'

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..')

const SUPPORT_TABLE_URL =
	'https://raw.githubusercontent.com/facebook/react-native-website/main/website/src/components/releases/_releases-table.md'
const REACT_NATIVE_URL = 'https://registry.npmjs.org/react-native'
const EXPO_TAGS_URL = 'https://registry.npmjs.org/-/package/expo/dist-tags'

try {
	const [supportTable, reactNative, expoPage] = await Promise.all([
		fetchText(SUPPORT_TABLE_URL),
		fetchJson(REACT_NATIVE_URL),
		fetchJson(EXPO_TAGS_URL),
	])

	const expoTags = stringMap(expoPage, 'the expo dist-tags')
	const tagNames = [
		...Object.keys(expoTags)
			.filter((tag) => /^sdk-\d+$/u.test(tag))
			.sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
		...('next' in expoTags ? ['next'] : []),
	]

	// The expo package of every candidate tag names the react-native version its SDK pins, which
	// decides whether the SDK's minor is inside the tested window.
	const bundledPages = await Promise.all(
		tagNames.map((tag) => fetchJson(`https://unpkg.com/expo@${expoTags[tag]}/bundledNativeModules.json`)),
	)

	/** @type {Record<string, string>} */
	const bundledRn = {}

	for (const [index, tag] of tagNames.entries()) {
		bundledRn[expoTags[tag]] = bundledReactNative(bundledPages[index])
	}

	const overrides = cellOverrides(
		/** @type {Record<string, unknown>} */
		(JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, 'e2e/matrix.overrides.json'), 'utf8'))),
	)

	const matrix = buildMatrix({
		bundledRn,
		date: new Date().toISOString().slice(0, 10),
		expoTags,
		overrides,
		rnVersions: reactNativeVersions(reactNative),
		supportTable,
	})

	writeFileSync(path.join(REPOSITORY_ROOT, 'e2e/matrix.json'), `${JSON.stringify(matrix, null, '\t')}\n`)

	writeFileSync(path.join(REPOSITORY_ROOT, 'docs/compatibility.md'), renderCompatibility(matrix))

	process.stdout.write(`e2e/matrix.json and docs/compatibility.md: ${matrix.cells.map((cell) => cell.id).join(', ')}\n`)
} catch (failure) {
	const message = failure instanceof Error ? failure.message : String(failure)

	process.stderr.write(`updating the e2e matrix failed: ${message}\n`)
	process.exit(1)
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
	const response = await fetch(url)

	if (!response.ok) {
		throw new Error(`fetching ${url} failed: ${response.status} ${response.statusText}`)
	}

	return response.text()
}

/**
 * @param {string} url
 * @returns {Promise<unknown>}
 */
async function fetchJson(url) {
	return (
		/** @type {unknown} */
		(JSON.parse(await fetchText(url)))
	)
}
