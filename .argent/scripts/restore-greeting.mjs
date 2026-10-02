// Undoes edit-greeting.mjs. Running it on an unedited greeting changes nothing.
import { readFile, writeFile } from 'node:fs/promises'

const examples = new URL('../../examples/', import.meta.url)

async function relabel(example) {
	const file = new URL(`${example}/src/Greeting.tsx`, examples)
	const source = await readFile(file, 'utf8')
	const restored = source.replace('Pressed {clicks} times.', 'Clicked {clicks} times.')

	// Metro pushes a hot update on every write, even of identical content, and a reload that races
	// the flow's first tap loses it. Skip the write when nothing would change.
	if (source !== restored) {
		await writeFile(file, restored)
	}
}

await Promise.all(['bare', 'expo'].map((example) => relabel(example)))
