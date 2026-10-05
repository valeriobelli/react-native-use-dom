import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@jest/globals'

import { renderCompatibility } from './matrix.mjs'

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..')

/** @type {{ cells: import('./matrix.mjs').MatrixCell[] }} */
const matrix = JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, 'e2e/matrix.json'), 'utf8'))

test('docs/compatibility.md is the page rendered from e2e/matrix.json', () => {
	// Run `pnpm e2e:matrix` to rewrite both files. Never edit the page by hand.
	expect(readFileSync(path.join(REPOSITORY_ROOT, 'docs/compatibility.md'), 'utf8')).toBe(renderCompatibility(matrix))
})

test('the page has one row per matrix cell', () => {
	const tableLines = renderCompatibility(matrix)
		.split('\n')
		.filter((line) => line.startsWith('|'))

	// The header row and the separator row come before the cells.
	expect(tableLines).toHaveLength(matrix.cells.length + 2)
})

test('the page labels each kind of cell', () => {
	const page = renderCompatibility(matrix)

	expect(page).toMatch(
		/\| React Native 0\.81 +\| Unsupported by React Native +\| `examples\/bare-0\.81` +\| nightly +\|/u,
	)
	expect(page).toMatch(/\| Expo SDK 57 \(React Native 0\.86\) +\| Active +\| `examples\/expo-57` +\| every change +\|/u)
	expect(page).toContain('Future (release candidate)')
	expect(page).toContain('https://reactnative.dev/releases/overview')
})

test('the page rejects a cell it cannot label', () => {
	expect(() => renderCompatibility({ cells: [{ ...matrix.cells[0], support: 'Maybe' }] })).toThrow(
		"the bare-0.85 cell has the support level 'Maybe'",
	)

	expect(() => renderCompatibility({ cells: [{ ...matrix.cells[0], role: 'extra' }] })).toThrow(
		"the bare-0.85 cell has the role 'extra'",
	)
})
