/** @type {import('jest').Config} */
module.exports = {
	collectCoverageFrom: ['packages/*/src/**/*.{ts,tsx}', '!packages/*/src/**/*.test.{ts,tsx}'],
	projects: [
		'<rootDir>/packages/react-native-use-dom/jest.node.cjs',
		'<rootDir>/packages/react-native-use-dom/jest.jsdom.cjs',
		'<rootDir>/jest.repo.cjs',
	],
	rootDir: '.',
}
