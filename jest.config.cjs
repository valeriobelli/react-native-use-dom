/** @type {import('jest').Config} */
module.exports = {
	rootDir: '.',
	projects: [
		'<rootDir>/packages/react-native-use-dom/jest.node.cjs',
		'<rootDir>/packages/react-native-use-dom/jest.jsdom.cjs',
	],
	collectCoverageFrom: ['packages/*/src/**/*.{ts,tsx}', '!packages/*/src/**/*.test.{ts,tsx}'],
}
