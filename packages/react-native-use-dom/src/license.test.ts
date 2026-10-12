import fs from 'node:fs'
import path from 'node:path'

const PACKAGE_ROOT = path.join(__dirname, '..')
const REPOSITORY_ROOT = path.join(PACKAGE_ROOT, '..', '..')

function readLicense({ directory }: { directory: string }): string {
	return fs.readFileSync(path.join(directory, 'LICENSE'), 'utf8')
}

// npm packs a package's own LICENSE whatever `files` says, so the copy in the package is the one
// users and scanners get. The repository root keeps one for GitHub, and the two must not drift.
it('ships the same LICENSE as the repository', () => {
	expect(readLicense({ directory: PACKAGE_ROOT })).toBe(readLicense({ directory: REPOSITORY_ROOT }))
})

it('is MIT licensed', () => {
	const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
		license?: string
	}

	expect(manifest.license).toBe('MIT')
	expect(readLicense({ directory: PACKAGE_ROOT })).toMatch(/^MIT License\n/u)
})
