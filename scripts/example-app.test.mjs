import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@jest/globals'

const root = path.resolve(__dirname, '..')
const sharedFolder = path.join(root, 'e2e/example-app')
const manifest = JSON.parse(readFileSync(path.join(sharedFolder, 'package.json'), 'utf8'))

// Babel injects runtime helper imports into the shared source. They must resolve from this package,
// not depend on a consuming app's dependency hoisting.
test('the shared app declares its Babel runtime dependency', () => {
	expect(manifest.dependencies['@babel/runtime']).toBeDefined()
})

// A registry copy has a different mount context from the workspace runtime, making its DOM hooks
// report that they were called outside a DOM component.
test('the shared app uses the workspace library rather than a second registry copy', () => {
	expect(manifest.peerDependencies['react-native-use-dom']).toBe('workspace:*')
})

test.each(['bare', 'expo'])('the %s example keeps the shared public assets', (example) => {
	const source = readFileSync(path.join(sharedFolder, 'public/atom.svg'), 'utf8')
	const appCopy = readFileSync(path.join(root, 'examples', example, 'public/atom.svg'), 'utf8')

	expect(appCopy).toBe(source)
})
