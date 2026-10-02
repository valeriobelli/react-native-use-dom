import fs from 'node:fs'
import path from 'node:path'

interface Manifest {
	name: string
	dependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
}

const PACKAGE_ROOT = path.join(__dirname, '..')

/** `expo`, `expo-*` and every `@expo/*` package. */
const EXPO_PACKAGE = /^(?:expo(?:$|-)|@expo\/)/u

/** Where Node would find `name` from `directory`: the nearest `node_modules` holding it. */
function findPackage(name: string, directory: string): string | undefined {
	const candidate = path.join(directory, 'node_modules', name, 'package.json')

	if (fs.existsSync(candidate)) {
		return path.dirname(fs.realpathSync(candidate))
	}

	const parent = path.dirname(directory)

	return parent === directory ? undefined : findPackage(name, parent)
}

function readManifest(directory: string): Manifest {
	return JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')) as Manifest
}

function requiredNames(manifest: Manifest): string[] {
	return Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies })
}

/**
 * Every package installing this one brings in, its peers included: the names its dependencies,
 * and theirs, require. A requirement nothing in the workspace installs is skipped, as an app
 * without it would not install it either.
 */
function dependencyTree(root: string): Set<string> {
	const seen = new Set<string>()
	const visited = new Set<string>([root])
	const pending = [root]

	for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
		for (const name of requiredNames(readManifest(directory))) {
			seen.add(name)
			const found = findPackage(name, directory)

			if (found !== undefined && !visited.has(found)) {
				visited.add(found)
				pending.push(found)
			}
		}
	}

	return seen
}

function sourceFiles(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(directory, entry.name)

		if (entry.isDirectory()) {
			return sourceFiles(file)
		}

		return /\.tsx?$/u.test(entry.name) && !entry.name.includes('.test.') ? [file] : []
	})
}

/** The module specifiers a source file imports or requires. */
function importedModules(file: string): string[] {
	const source = fs.readFileSync(file, 'utf8')

	return [...source.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^import\s+)'([^']+)'/gmu)].map(
		([, specifier]) => specifier ?? '',
	)
}

it('brings in no Expo package, directly or through its dependencies', () => {
	expect([...dependencyTree(PACKAGE_ROOT)].filter((name) => EXPO_PACKAGE.test(name))).toStrictEqual([])
})

it('imports no Expo package from its source', () => {
	const imported = sourceFiles(path.join(PACKAGE_ROOT, 'src')).flatMap((file) => importedModules(file))

	expect(imported).toContain('react-native')
	expect(imported.filter((specifier) => EXPO_PACKAGE.test(specifier))).toStrictEqual([])
})
