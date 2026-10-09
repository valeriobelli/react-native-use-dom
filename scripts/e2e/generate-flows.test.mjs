import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, expect, test } from '@jest/globals'

import { DEV_SCENARIO, generateFlows, planCell, RELEASE_SCENARIOS } from './generate-flows.mjs'

const bare = { bundleId: 'dev.reactnativeusedom.bare087', id: 'bare-0.87', slug: 'bare087' }
const expo = { bundleId: 'dev.reactnativeusedom.expo57', id: 'expo-57', slug: 'expo57' }

/** @type {string} */
let root

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), 'generate-flows-'))
})

afterEach(() => {
	rmSync(root, { force: true, recursive: true })
})

test('a bare cell gets six release wrappers and one dev wrapper', () => {
	const files = planCell(bare)

	expect([...files.keys()]).toEqual([
		'bare-0.87/release/bare087-errors.yaml',
		'bare-0.87/release/bare087-first-render.yaml',
		'bare-0.87/release/bare087-native-action.yaml',
		'bare-0.87/release/bare087-navigation-blocked.yaml',
		'bare-0.87/release/bare087-prop-change.yaml',
		'bare-0.87/release/bare087-refs.yaml',
		'bare-0.87/dev/bare087-fast-refresh.yaml',
	])

	expect(files.get('bare-0.87/release/bare087-refs.yaml')).toBe(
		`steps:
  - launch: { ios: dev.reactnativeusedom.bare087, android: dev.reactnativeusedom.bare087 }
  - run: ../../shared/refs
`,
	)
})

test('the navigation-blocked wrapper brings its own app back on iOS before reading the report', () => {
	expect(planCell(bare).get('bare-0.87/release/bare087-navigation-blocked.yaml')).toBe(
		`steps:
  - launch: { ios: dev.reactnativeusedom.bare087, android: dev.reactnativeusedom.bare087 }
  - run: ../../shared/navigation-blocked
  - when: { platform: ios }
    steps:
      - tool: launch-app
        args: { bundleId: dev.reactnativeusedom.bare087 }
  - run: ../../shared/navigation-reported
`,
	)
})

test('an Expo cell gets its own bundle id and slug', () => {
	const files = planCell(expo)

	expect(files.size).toBe(RELEASE_SCENARIOS.length + 1)

	expect(files.get(`expo-57/dev/expo57-${DEV_SCENARIO}.yaml`)).toBe(
		`steps:
  - launch: { ios: dev.reactnativeusedom.expo57, android: dev.reactnativeusedom.expo57 }
  - run: ../../shared/fast-refresh
`,
	)
})

test('an app outside the matrix is deleted with its baselines, the rest stays', () => {
	const flows = path.join(root, '.argent', 'flows')
	const kept = path.join(flows, 'bare-0.87', 'dev', '__baselines__', 'y', 'b.png')

	mkdirSync(path.join(flows, 'shared'), { recursive: true })
	writeFileSync(path.join(flows, 'shared', 'ready.yaml'), 'steps: []\n')
	mkdirSync(path.join(flows, 'bare-0.80', 'release', '__baselines__', 'x'), { recursive: true })
	writeFileSync(path.join(flows, 'bare-0.80', 'release', '__baselines__', 'x', 'a.png'), 'png')
	mkdirSync(path.dirname(kept), { recursive: true })
	writeFileSync(kept, 'png')

	const result = generateFlows({ cells: [bare], root })

	expect(result.deleted).toEqual(['bare-0.80'])
	expect(existsSync(path.join(flows, 'bare-0.80'))).toBe(false)
	expect(existsSync(path.join(flows, 'shared', 'ready.yaml'))).toBe(true)
	expect(readFileSync(kept, 'utf8')).toBe('png')
	expect(readdirSync(path.join(flows, 'bare-0.87', 'release'))).toHaveLength(RELEASE_SCENARIOS.length)
})

test('a second run writes the same files', () => {
	const refs = path.join(root, '.argent', 'flows', 'expo-57', 'release', 'expo57-refs.yaml')

	generateFlows({ cells: [bare, expo], root })

	const first = readFileSync(refs, 'utf8')
	const result = generateFlows({ cells: [bare, expo], root })

	expect(result.deleted).toEqual([])
	expect(readFileSync(refs, 'utf8')).toBe(first)
})
