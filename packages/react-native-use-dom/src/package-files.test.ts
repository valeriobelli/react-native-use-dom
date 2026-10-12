import { execFileSync } from 'node:child_process'
import path from 'node:path'

const PACKAGE_ROOT = path.join(__dirname, '..')

interface PackResult {
	files: { path: string }[]
}

/** The files `npm pack` would publish, from the build output present now. */
function packedFiles(): string[] {
	const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
		cwd: PACKAGE_ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	})
	const [result] = JSON.parse(output) as PackResult[]

	return (result?.files ?? []).map((file) => file.path)
}

// Socket scores a package's size, and maps and sources more than doubled it while nothing at
// runtime reads them: the built code in `lib` is self-contained.
it('publishes neither source maps nor TypeScript sources', () => {
	const files = packedFiles()

	expect(files).toContain('package.json')
	expect(files.filter((file) => file.endsWith('.map'))).toStrictEqual([])
	expect(files.filter((file) => file.startsWith('src/'))).toStrictEqual([])
})
