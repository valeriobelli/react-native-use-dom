import { defineConfig } from 'oxlint'

export default defineConfig({
	categories: {
		correctness: 'error',
		pedantic: 'warn',
		perf: 'warn',
		suspicious: 'error',
	},
	env: {
		es2024: true,
		node: true,
	},
	ignorePatterns: [
		'**/dist/**',
		'**/lib/**',
		'**/node_modules/**',
		'**/Pods/**',
		'**/build/**',
		'**/nitrogen/generated/**',
	],
	jsPlugins: ['@stylistic/eslint-plugin'],
	options: {
		typeAware: true,
	},
	overrides: [
		{
			files: ['oxlint.config.mts', 'oxfmt.config.mts', 'commitlint.config.mjs'],
			rules: {
				'import/no-default-export': 'off',
			},
		},
		{
			// Example apps and their JS config entrypoints wire RN's type graph through untyped
			// `require`s, which oxlint's type service partially fails to resolve (tsc is fine); the
			// unsafe-* family would only ever see `any` or error types there.
			files: ['examples/**'],
			rules: {
				'typescript/no-unsafe-argument': 'off',
				'typescript/no-unsafe-assignment': 'off',
				'typescript/no-unsafe-call': 'off',
				'typescript/no-unsafe-member-access': 'off',
				'typescript/no-unsafe-return': 'off',
			},
		},
		{
			// App code defaults-exports its screens, and `'use dom'` modules must default-export their
			// component — the rule guards library source only.
			files: ['examples/**/*.{ts,tsx}', 'packages/react-native-use-dom/src/__tests__/types/**'],
			rules: {
				'import/no-default-export': 'off',
			},
		},
		{
			files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', '**/__fixtures__/**'],
			rules: {
				'max-lines-per-function': 'off',
				'no-console': 'off',
				'promise/always-return': 'off',
				'react-perf/jsx-no-new-array-as-prop': 'off',
				'react-perf/jsx-no-new-function-as-prop': 'off',
				'react-perf/jsx-no-new-object-as-prop': 'off',
				// Test idioms: mocks are value-returning functions handed to void slots, and not every
				// async test awaits. The typescript-plugin variants need disabling separately from the
				// base rules above. Tests also exercise deprecated surfaces (Metro's `enhanceMiddleware`)
				// on purpose, and jest's matcher types are loose by design.
				'require-await': 'off',
				'typescript/no-deprecated': 'off',
				'typescript/no-extraneous-class': 'off',
				'typescript/no-unsafe-argument': 'off',
				'typescript/no-unsafe-assignment': 'off',
				'typescript/no-unsafe-call': 'off',
				'typescript/no-unsafe-member-access': 'off',
				'typescript/no-unsafe-return': 'off',
				'typescript/require-await': 'off',
				'typescript/strict-void-return': 'off',
				'unicorn/no-useless-undefined': 'off',
			},
		},
	],
	plugins: ['typescript', 'react', 'react-perf', 'unicorn', 'import', 'jest', 'promise'],
	rules: {
		'@stylistic/padding-line-between-statements': [
			'error',
			{ blankLine: 'always', next: 'return', prev: '*' },
			{ blankLine: 'always', next: '*', prev: ['const', 'let'] },
			{ blankLine: 'any', next: ['const', 'let'], prev: ['const', 'let'] },
			{ blankLine: 'always', next: ['multiline-expression', 'block-like'], prev: '*' },
			{ blankLine: 'always', next: '*', prev: 'block-like' },
		],
		curly: ['error', 'all'],
		eqeqeq: [
			'error',
			'always',
			{
				null: 'ignore',
			},
		],
		'import/no-default-export': 'error',
		'import/no-unassigned-import': [
			'error',
			{
				allow: ['**/*.css'],
			},
		],
		'no-console': 'error',
		'no-duplicate-imports': [
			'error',
			{
				allowSeparateTypeImports: true,
				// oxlint 1.86 counts every named specifier of an `export { a, b } from` as a duplicate,
				// which outlaws multi-name barrels entirely; keep the rule to duplicate statements.
				includeExports: false,
			},
		],
		'no-redeclare': 'off',
		'react/function-component-definition': [
			'error',
			{
				namedComponents: 'function-declaration',
				unnamedComponents: 'arrow-function',
			},
		],
		'react/react-in-jsx-scope': 'off',
		'sort-keys': 'error',
		'typescript/consistent-type-imports': 'error',
		'typescript/no-explicit-any': 'error',
		// The library's contract is untyped JSON crossing the JS bridge: casts at those boundaries
		// follow runtime validation (`assertSerializable`, the wire guards), which a type assertion
		// rule cannot see. Rewriting every boundary cast into a guard would trade a real risk
		// (silent shape drift) for a stylistic one.
		'typescript/no-unsafe-type-assertion': 'off',
		'typescript/prefer-readonly-parameter-types': 'off',
		'typescript/strict-boolean-expressions': [
			'error',
			{
				allowNullableBoolean: true,
				allowNullableNumber: true,
				allowNullableObject: true,
				allowNullableString: true,
			},
		],
		'unicorn/empty-brace-spaces': 'error',
		'unicorn/no-array-reverse': 'off',
		'unicorn/no-array-sort': 'off',
	},
})
