import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@jest/globals'

const requiredHeadings = ['Status', 'Context', 'Decision', 'Consequences']

/**
 * Reads a page of the wiki.
 *
 * @param {string} wikiFolder
 * @param {string} page
 */
function readPage(wikiFolder, page) {
	return readFileSync(path.join(wikiFolder, page), 'utf8')
}

/**
 * Lists the ADR files of a wiki folder.
 *
 * @param {string} wikiFolder
 */
function listAdrs(wikiFolder) {
	return readdirSync(wikiFolder)
		.filter((file) => /^ADR-.*\.md$/u.test(file))
		.sort()
}

/**
 * Returns the targets of the links in `Home.md`.
 *
 * @param {string} wikiFolder
 */
function readHomeLinks(wikiFolder) {
	const home = readPage(wikiFolder, 'Home.md')

	return [...home.matchAll(/\]\(([^)\s]+)\)/gu)].map((match) => match[1] ?? '')
}

/**
 * Returns the ADR files that `Home.md` does not link.
 *
 * @param {string} wikiFolder
 */
function findUnlistedAdrs(wikiFolder) {
	const linked = new Set(readHomeLinks(wikiFolder))

	return listAdrs(wikiFolder).filter((file) => !linked.has(file))
}

/**
 * Returns the local pages `Home.md` links that do not exist.
 *
 * @param {string} wikiFolder
 */
function findBrokenHomeLinks(wikiFolder) {
	const pages = new Set(readdirSync(wikiFolder))

	return readHomeLinks(wikiFolder)
		.filter((target) => !/^(?:[a-z][a-z0-9+.-]*:|#)/iu.test(target))
		.filter((target) => !pages.has(target.split('#')[0] ?? ''))
}

/**
 * Returns the `##` headings of a page, in order.
 *
 * @param {string} content
 */
function readHeadings(content) {
	return [...content.matchAll(/^## (.+?)\s*$/gmu)].map((match) => match[1])
}

const wikiFolder = path.resolve(__dirname, '..', 'wiki')

test('every ADR is listed in Home.md', () => {
	expect(findUnlistedAdrs(wikiFolder)).toEqual([])
})

test('Home.md links only files that exist', () => {
	expect(findBrokenHomeLinks(wikiFolder)).toEqual([])
})

test.each(listAdrs(wikiFolder))('%s has the four headings, in order', (file) => {
	expect(readHeadings(readPage(wikiFolder, file))).toEqual(requiredHeadings)
})
