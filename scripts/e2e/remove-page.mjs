import { readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

/** The text the example app's `Missing` DOM component renders, so its page can be found by content. */
export const MISSING_PAGE_MARKER = 'use-dom-e2e-missing-page'

/**
 * The name of the page whose script holds `marker`, or `null`. Pages are named `<md5>.html`, and each
 * has a sibling `<md5>.js`: the HTML wraps the script, so the marker is in the script's contents.
 *
 * @param {{ name: string, contents: string }[]} files - Every file in the page folder.
 * @param {string} marker - The text to look for.
 */
export function findPageByMarker(files, marker = MISSING_PAGE_MARKER) {
	for (const file of files) {
		if (file.name.endsWith('.js') && file.contents.includes(marker)) {
			return `${file.name.slice(0, -'.js'.length)}.html`
		}
	}

	return null
}

/**
 * Deletes the page (and its script) whose contents hold `marker` from `bundleDirectory`, so the app
 * asks for a page that is missing. Throws when no page holds the marker, so a build that forgot the
 * example's `Missing` component fails loudly instead of leaving a flow to pass on an unrelated page.
 *
 * @param {string} bundleDirectory - The `dom.bundle` folder of a built app.
 * @param {string} marker - The text to look for.
 * @returns {string} The page file that was removed.
 */
export function removePageByMarker(bundleDirectory, marker = MISSING_PAGE_MARKER) {
	const files = readdirSync(bundleDirectory)
		.filter((name) => name.endsWith('.js'))
		.map((name) => ({ contents: readFileSync(path.join(bundleDirectory, name), 'utf8'), name }))

	const page = findPageByMarker(files, marker)

	if (page === null) {
		throw new Error(`no page in ${bundleDirectory} holds the marker "${marker}"`)
	}

	rmSync(path.join(bundleDirectory, page))
	rmSync(path.join(bundleDirectory, page.replace(/\.html$/u, '.js')))

	return page
}
