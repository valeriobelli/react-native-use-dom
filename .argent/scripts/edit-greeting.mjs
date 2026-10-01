// Edits the label of the examples' greeting, as a developer would, to trigger a hot update.
import { readFile, writeFile } from 'node:fs/promises';

const examples = new URL('../../examples/', import.meta.url);

async function relabel(example) {
	const file = new URL(`${example}/src/Greeting.tsx`, examples);
	const source = await readFile(file, 'utf8');
	await writeFile(file, source.replace('Clicked {clicks} times.', 'Pressed {clicks} times.'));
}

await Promise.all(['bare', 'expo'].map((example) => relabel(example)));
