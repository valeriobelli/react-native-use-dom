import fs from 'node:fs'
import path from 'node:path'

import type { types as t } from '@babel/core'
import { parseSync } from '@babel/core'

const PACKAGE_ROOT = path.join(__dirname, '..')

interface Manifest {
	exports: Record<string, string | { types: string; default?: string }>
}

/** The source module of every entry point the package publishes, by its import specifier. */
function entryPoints(): Map<string, string> {
	const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as Manifest
	const entries = new Map<string, string>()
	for (const [subpath, target] of Object.entries(manifest.exports)) {
		// A declaration file of its own (`./css`) is checked on its own below.
		if (typeof target === 'string' || !target.types.startsWith('./dist/')) continue
		const types = target.types.replace(/^\.\/dist\/(.*)\.d\.ts$/u, './src/$1.ts')
		entries.set(path.posix.join('react-native-use-dom', subpath), path.join(PACKAGE_ROOT, types))
	}
	return entries
}

function parse(file: string): t.File {
	const ast = parseSync(fs.readFileSync(file, 'utf8'), {
		filename: file,
		babelrc: false,
		configFile: false,
		parserOpts: { plugins: [['typescript', { dts: file.endsWith('.d.ts') }], 'jsx'] },
	})
	if (ast === null) throw new Error(`could not parse ${file}`)
	return ast
}

function resolveModule(from: string, specifier: string): string {
	const base = path.resolve(path.dirname(from), specifier)
	const candidates = ['.ts', '.tsx', '/index.ts'].map((extension) => `${base}${extension}`)
	const found = candidates.find((candidate) => fs.existsSync(candidate))
	if (found === undefined) throw new Error(`cannot resolve ${specifier} from ${from}`)
	return found
}

function hasTsdoc(node: t.Node): boolean {
	return (node.leadingComments ?? []).some(
		(comment) => comment.type === 'CommentBlock' && comment.value.startsWith('*'),
	)
}

function declaredNames(declaration: t.Declaration): string[] {
	if (declaration.type === 'VariableDeclaration') {
		return declaration.declarations.flatMap((declarator) =>
			declarator.id.type === 'Identifier' ? [declarator.id.name] : [],
		)
	}
	return 'id' in declaration && declaration.id?.type === 'Identifier' ? [declaration.id.name] : []
}

/** Whether `name`, as `file` exports it, is declared with TSDoc, following re-exports to the source. */
function isDocumented(file: string, name: string): boolean {
	for (const statement of parse(file).program.body) {
		if (statement.type === 'ExportDefaultDeclaration' && name === 'default') return hasTsdoc(statement)
		if (statement.type !== 'ExportNamedDeclaration') continue
		if (statement.declaration && declaredNames(statement.declaration).includes(name)) return hasTsdoc(statement)
		const specifier = statement.specifiers.find(
			(candidate) => candidate.exported.type === 'Identifier' && candidate.exported.name === name,
		)
		if (specifier?.type === 'ExportSpecifier' && statement.source) {
			return isDocumented(resolveModule(file, statement.source.value), specifier.local.name)
		}
	}
	throw new Error(`${file} does not export ${name}`)
}

/** The names `file` exports. */
function exportedNames(file: string): string[] {
	return parse(file).program.body.flatMap((statement) => {
		if (statement.type === 'ExportDefaultDeclaration') return ['default']
		if (statement.type !== 'ExportNamedDeclaration') return []
		if (statement.declaration) return declaredNames(statement.declaration)
		return statement.specifiers.flatMap((specifier) =>
			specifier.exported.type === 'Identifier' ? [specifier.exported.name] : [],
		)
	})
}

describe.each([...entryPoints()])('%s', (_entry, file) => {
	it.each(exportedNames(file))('documents %s', (name) => {
		expect(isDocumented(file, name)).toBe(true)
	})
})

it('declares stylesheet modules for TypeScript, with TSDoc', () => {
	const declarations = parse(path.join(PACKAGE_ROOT, 'css.d.ts')).program.body

	expect(declarations.map((declaration) => [declaration.type, hasTsdoc(declaration)])).toStrictEqual([
		['TSModuleDeclaration', true],
	])
})
