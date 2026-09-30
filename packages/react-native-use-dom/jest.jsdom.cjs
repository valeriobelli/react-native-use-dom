/** Modules that run inside the WebView and need real DOM globals. */
/** @type {import('jest').Config} */
module.exports = {
	displayName: 'dom',
	rootDir: __dirname,
	testEnvironment: 'jsdom',
	testMatch: ['<rootDir>/src/web/**/*.test.{ts,tsx}'],
	transform: { '^.+\\.[jt]sx?$': ['babel-jest', { rootMode: 'upward' }] },
};
