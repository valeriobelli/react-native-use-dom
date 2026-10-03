/// <reference types="node" />

// Edits the label of the shared greeting, as a developer would, to trigger a hot update.
import { readFile, writeFile } from 'node:fs/promises'

const file = new URL('../../e2e/example-app/src/Greeting.tsx', import.meta.url)
const source = await readFile(file, 'utf8')

await writeFile(file, source.replace('Clicked {clicks} times.', 'Pressed {clicks} times.'))
