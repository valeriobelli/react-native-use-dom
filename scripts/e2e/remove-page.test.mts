import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from '@jest/globals'

import { findPageByMarker, removePageByMarker } from './remove-page.mts'

const MARKER = 'use-dom-e2e-missing-page'

test('finds the page whose script holds the marker', () => {
	const files = [
		{ contents: 'nothing here', name: 'aaaa.js' },
		{ contents: `var text = "${MARKER}";`, name: 'bbbb.js' },
	]

	expect(findPageByMarker({ files, marker: MARKER })).toBe('bbbb.html')
})

test('finds no page when no script holds the marker', () => {
	expect(findPageByMarker({ files: [{ contents: 'nothing here', name: 'aaaa.js' }], marker: MARKER })).toBeNull()
})

test('removes the page and its script, and throws when the marker is absent', () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'use-dom-page-'))

	try {
		writeFileSync(path.join(directory, 'aaaa.html'), '<script src="aaaa.js"></script>')
		writeFileSync(path.join(directory, 'aaaa.js'), 'var text = "nothing";')
		writeFileSync(path.join(directory, 'bbbb.html'), '<script src="bbbb.js"></script>')
		writeFileSync(path.join(directory, 'bbbb.js'), `var text = "${MARKER}";`)

		expect(removePageByMarker({ bundleDirectory: directory, marker: MARKER })).toBe('bbbb.html')
		// The page and the script it loads are both gone, and the other page stays.
		expect(existsSync(path.join(directory, 'bbbb.html'))).toBe(false)
		expect(existsSync(path.join(directory, 'bbbb.js'))).toBe(false)
		expect(existsSync(path.join(directory, 'aaaa.html'))).toBe(true)
		expect(existsSync(path.join(directory, 'aaaa.js'))).toBe(true)

		expect(() => removePageByMarker({ bundleDirectory: directory, marker: MARKER })).toThrow(
			`no page in ${directory} holds the marker`,
		)
	} finally {
		rmSync(directory, { force: true, recursive: true })
	}
})
