import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@jest/globals'

const requiredHeadings = ['Status', 'Context', 'Decision', 'Consequences']

/**
 * Reads a page of the wiki.
 *
 * @param wikiFolder the wiki's folder
 * @param page the page's file name
 */
function readPage(wikiFolder: string, page: string): string {
	return readFileSync(path.join(wikiFolder, page), 'utf8')
}

/**
 * Lists the ADR files of a wiki folder.
 *
 * @param wikiFolder the wiki's folder
 */
function listAdrs(wikiFolder: string): string[] {
	return readdirSync(wikiFolder)
		.filter((file) => /^ADR-.*\.md$/u.test(file))
		.sort()
}

/**
 * Returns the targets of the links in `Home.md`.
 *
 * @param wikiFolder the wiki's folder
 */
function readHomeLinks(wikiFolder: string): string[] {
	const home = readPage(wikiFolder, 'Home.md')

	return [...home.matchAll(/\]\(([^)\s]+)\)/gu)].map((match) => match[1] ?? '')
}

/**
 * Returns the ADR files that `Home.md` does not link.
 *
 * @param wikiFolder the wiki's folder
 */
function findUnlistedAdrs(wikiFolder: string): string[] {
	const linked = new Set(readHomeLinks(wikiFolder))

	return listAdrs(wikiFolder).filter((file) => !linked.has(file))
}

/**
 * Returns the local pages `Home.md` links that do not exist.
 *
 * @param wikiFolder the wiki's folder
 */
function findBrokenHomeLinks(wikiFolder: string): string[] {
	const pages = new Set(readdirSync(wikiFolder))

	return readHomeLinks(wikiFolder)
		.filter((target) => !/^(?:[a-z][a-z0-9+.-]*:|#)/iu.test(target))
		.filter((target) => !pages.has(target.split('#')[0] ?? ''))
}

/**
 * Returns the `##` headings of a page, in order.
 *
 * @param content the page's markdown
 */
function readHeadings(content: string): (string | undefined)[] {
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
