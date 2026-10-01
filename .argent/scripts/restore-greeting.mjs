// Undoes edit-greeting.mjs. Running it on an unedited greeting changes nothing.
import { readFile, writeFile } from 'node:fs/promises'

const examples = new URL('../../examples/', import.meta.url)

async function relabel(example) {
	const file = new URL(`${example}/src/Greeting.tsx`, examples)
	const source = await readFile(file, 'utf8')
	await writeFile(file, source.replace('Pressed {clicks} times.', 'Clicked {clicks} times.'))
}

await Promise.all(['bare', 'expo'].map((example) => relabel(example)))
