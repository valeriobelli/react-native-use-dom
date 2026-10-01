/** Modules that run in Node: the package as a whole, the bundler integration, the Babel plugin, and
 * the runtime logic the native side shares with it. Anything that touches the DOM belongs to the jsdom project. */
/** @type {import('jest').Config} */
module.exports = {
	displayName: 'node',
	rootDir: __dirname,
	testEnvironment: 'node',
	testMatch: ['<rootDir>/src/*.test.ts', '<rootDir>/src/{runtime,babel,metro,native}/**/*.test.ts'],
	transform: { '^.+\\.[jt]sx?$': ['babel-jest', { rootMode: 'upward' }] },
};
