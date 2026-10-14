import type { KnipConfig } from 'knip'

// Babel's runtime transform rewrites helpers into `@babel/runtime` imports that resolve from the
// transformed file, so a package whose source an app bundles declares it without importing it.
const BABEL_RUNTIME = '@babel/runtime'

export default {
	// The workflows and the Expo generator run it in an Expo example, which lists it, through a
	// working directory knip cannot resolve: a matrix value or a computed `cwd`.
	ignoreBinaries: ['expo'],
	workspaces: {
		'.': {
			// The Argent flows run the scripts in `.argent/scripts` by path.
			entry: ['scripts/**/*.cli.mts', '.argent/scripts/**/*.mjs'],
			jest: {
				config: ['jest.config.cjs', 'jest.repo.cjs'],
			},
			project: ['scripts/**/*.mts', '.argent/scripts/**/*.mjs'],
		},
		'e2e/*': {
			ignoreDependencies: [BABEL_RUNTIME],
		},
		'examples/bare-*': {
			// Picks up `hot-updater.config.ts`, which the Hot Updater CLI loads, in the examples with one.
			entry: ['*.config.{js,ts}'],
			// The React Native template's: the Gradle and Xcode builds and Babel's helpers load them.
			ignoreDependencies: [
				'@babel/preset-env',
				BABEL_RUNTIME,
				'@react-native/codegen',
				'@react-native/gradle-plugin',
				'hermes-compiler',
			],
		},
		'examples/expo-*': {
			// Also the `with-*` config plugins, which `app.json` lists by path, and `hot-updater.config.ts`,
			// which the Hot Updater CLI loads, in the examples with them.
			entry: ['{*.config,with-*}.{js,ts}'],
			// Knip's Expo plugin expects it unless `app.json` disables updates. The examples update over
			// the air with Hot Updater instead.
			ignoreDependencies: ['expo-updates'],
		},
		'packages/react-native-use-dom': {
			entry: [
				'src/{babel,metro,native,runtime,web}/index.ts',
				'src/__tests__/types/**/*.{ts,tsx}',
				// Nitrogen generates the native view from the spec's exported types.
				'src/native/specs/*.nitro.ts',
			],
			ignoreDependencies: [
				BABEL_RUNTIME,
				// Metro's type declarations import `ws`, and without it its websocket server is an error type.
				'@types/ws',
			],
			jest: {
				config: ['jest.node.cjs', 'jest.jsdom.cjs'],
			},
			project: ['src/**/*.{ts,tsx}', 'scripts/*.mjs'],
		},
	},
} satisfies KnipConfig
