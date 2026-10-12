import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from '@jest/globals'

import { findPageByMarker, removePageByMarker } from './remove-page.mjs'

const MARKER = 'use-dom-e2e-missing-page'

test('finds the page whose script holds the marker', () => {
	const files = [
		{ contents: 'nothing here', name: 'aaaa.js' },
		{ contents: `var text = "${MARKER}";`, name: 'bbbb.js' },
	]

	expect(findPageByMarker(files, MARKER)).toBe('bbbb.html')
})

test('finds no page when no script holds the marker', () => {
	expect(findPageByMarker([{ contents: 'nothing here', name: 'aaaa.js' }], MARKER)).toBeNull()
})

test('removes the page and its script, and throws when the marker is absent', () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'use-dom-page-'))

	try {
		writeFileSync(path.join(directory, 'aaaa.html'), '<script src="aaaa.js"></script>')
		writeFileSync(path.join(directory, 'aaaa.js'), 'var text = "nothing";')
		writeFileSync(path.join(directory, 'bbbb.html'), '<script src="bbbb.js"></script>')
		writeFileSync(path.join(directory, 'bbbb.js'), `var text = "${MARKER}";`)

		expect(removePageByMarker(directory, MARKER)).toBe('bbbb.html')
		expect(findPageByMarker([{ contents: 'var text = "nothing";', name: 'aaaa.js' }], MARKER)).toBeNull()
		expect(() => removePageByMarker(directory, MARKER)).toThrow(`no page in ${directory} holds the marker`)
	} finally {
		rmSync(directory, { force: true, recursive: true })
	}
})
