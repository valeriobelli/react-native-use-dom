import { defineConfig } from 'oxfmt'

export default defineConfig({
	arrowParens: 'always',
	ignorePatterns: [
		'**/dist/**',
		'**/lib/**',
		'**/Pods/**',
		'pnpm-lock.yaml',
		'**/build/**',
		'**/nitrogen/generated/**',
	],
	printWidth: 120,
	semi: false,
	singleQuote: true,
	sortImports: true,
	sortPackageJson: true,
	trailingComma: 'all',
})
