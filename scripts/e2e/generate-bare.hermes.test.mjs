import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { expect, test } from '@jest/globals'

import { pinHermesCompiler } from './generate-bare.hermes.mjs'

const target = /** @type {import('./matrix.mjs').MatrixCell} */ (
	/** @type {unknown} */ ({ folder: 'examples/bare-0.99' })
)

/**
 * @param {(root: string, read: () => { devDependencies: Record<string, string> }) => void} check
 */
function withExample(check) {
	const root = mkdtempSync(path.join(tmpdir(), 'hermes-'))

	try {
		mkdirSync(path.join(root, target.folder), { recursive: true })

		writeFileSync(
			path.join(root, target.folder, 'package.json'),
			JSON.stringify({ devDependencies: { '@react-native/babel-preset': '0.99.0' } }),
		)

		check(root, () => JSON.parse(readFileSync(path.join(root, target.folder, 'package.json'), 'utf8')))
	} finally {
		rmSync(root, { force: true, recursive: true })
	}
}

test('pinHermesCompiler names the version react-native depends on, once, and keeps the keys sorted', () => {
	withExample((root, read) => {
		expect(pinHermesCompiler(root, target, '250829098.0.17')).toBe(true)

		expect(read().devDependencies).toEqual({
			'@react-native/babel-preset': '0.99.0',
			'hermes-compiler': '250829098.0.17',
		})
		expect(Object.keys(read().devDependencies)).toEqual(['@react-native/babel-preset', 'hermes-compiler'])
		expect(pinHermesCompiler(root, target, '250829098.0.17')).toBe(false)
		expect(pinHermesCompiler(root, target, '260318099.0.4')).toBe(true)
		expect(read().devDependencies['hermes-compiler']).toBe('260318099.0.4')
	})
})

test('pinHermesCompiler removes the package when the react-native version ships hermesc itself', () => {
	withExample((root, read) => {
		pinHermesCompiler(root, target, '250829098.0.17')

		expect(pinHermesCompiler(root, target, null)).toBe(true)
		expect(read().devDependencies).toEqual({ '@react-native/babel-preset': '0.99.0' })
		expect(pinHermesCompiler(root, target, null)).toBe(false)
	})
})
