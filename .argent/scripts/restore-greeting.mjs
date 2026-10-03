/// <reference types="node" />

// Undoes edit-greeting.mjs. Running it on an unedited greeting changes nothing.
import { readFile, writeFile } from 'node:fs/promises'

const file = new URL('../../e2e/example-app/src/Greeting.tsx', import.meta.url)
const source = await readFile(file, 'utf8')
const restored = source.replace('Pressed {clicks} times.', 'Clicked {clicks} times.')

// Metro pushes a hot update on every write, even of identical content, and a reload that races
// the flow's first tap loses it. Skip the write when nothing would change.
if (source !== restored) {
	await writeFile(file, restored)
}
