import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { expect, test } from '@jest/globals'

import { applyHermesCommand } from './generate-bare.hermes.mjs'

test('applyHermesCommand points the Release build at the hermesc pnpm installed, once', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'hermes-'))
	const app = path.join(root, 'examples', 'bare-0.99', 'android', 'app')

	try {
		mkdirSync(app, { recursive: true })

		writeFileSync(
			path.join(app, 'build.gradle'),
			'react {\n    // hermesCommand = "$rootDir/my-custom-hermesc/bin/hermesc"\n}\n',
		)

		const target = { folder: 'examples/bare-0.99' }

		expect(applyHermesCommand(root, target)).toBe(true)
		expect(readFileSync(path.join(app, 'build.gradle'), 'utf8')).toContain('    hermesCommand = new File(')
		expect(applyHermesCommand(root, target)).toBe(false)
	} finally {
		rmSync(root, { force: true, recursive: true })
	}
})
