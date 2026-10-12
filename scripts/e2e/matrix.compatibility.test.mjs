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

	expect(page).toMatch(/\| React Native 0\.85 +\| End of Cycle +\| `examples\/bare-0\.85` +\| every change +\|/u)
	expect(page).toMatch(/\| Expo SDK 57 \(React Native 0\.86\) +\| Active +\| `examples\/expo-57` +\| every change +\|/u)
	expect(page).toContain('Future (release candidate)')
	expect(page).toContain('https://reactnative.dev/releases/overview')
})

test('the page names the floor, and the versions only the nightly floor check covers', () => {
	expect(renderCompatibility(matrix)).toContain('- React Native versions below 0.85 are not supported.')
	expect(renderCompatibility(matrix)).not.toContain('not tested')

	// The window once React Native 0.87 is the oldest version it supports.
	const page = renderCompatibility(pastTheFloor({ dropped: ['0.85', '0.86'] }))

	expect(page).toMatch(
		/\| React Native 0\.85 +\| Unsupported by React Native +\| `examples\/bare-0\.85` +\| nightly +\|/u,
	)
	expect(page).toContain('- React Native 0.86 is not tested.')

	expect(renderCompatibility(pastTheFloor({ dropped: ['0.85', '0.86', '0.87'] }))).toContain(
		'- React Native 0.86 to 0.87 are not tested.',
	)
})

/**
 * The matrix once React Native stops supporting the floor and the minors after it: their cells leave
 * the window, and the floor comes back as a nightly cell.
 *
 * @param {{ dropped: string[] }} options the minors that left the window
 * @returns {{ cells: import('./matrix.mjs').MatrixCell[] }}
 */
function pastTheFloor({ dropped }) {
	const kept = matrix.cells.filter((cell) => !dropped.includes(cell.reactNative.split('.').slice(0, 2).join('.')))

	return { cells: [...kept, { ...matrix.cells[0], role: 'floor', support: 'Unsupported' }] }
}

test('the page rejects a cell it cannot label', () => {
	expect(() => renderCompatibility({ cells: [{ ...matrix.cells[0], support: 'Maybe' }] })).toThrow(
		"the bare-0.85 cell has the support level 'Maybe'",
	)

	expect(() => renderCompatibility({ cells: [{ ...matrix.cells[0], role: 'extra' }] })).toThrow(
		"the bare-0.85 cell has the role 'extra'",
	)
})
