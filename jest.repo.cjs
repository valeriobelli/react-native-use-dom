/** Repository-level tests: scripts, templates, wiki and docs that live outside the packages. */
/** @type {import('jest').Config} */
module.exports = {
	displayName: 'repo',
	// Only scripts/ is searched: the packages' build output holds stale snapshot files that jest
	// would otherwise report as obsolete and fail the run.
	rootDir: __dirname,
	roots: ['<rootDir>/scripts'],
	testEnvironment: 'node',
	testMatch: ['**/*.test.mjs'],
	transform: { '^.+\\.m?[jt]sx?$': ['babel-jest', { rootMode: 'upward' }] },
}
