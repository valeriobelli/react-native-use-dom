/**
 * The files the bare generator writes itself, over the template's, and what it takes out of the
 * template. They are kept here, formatted the way the repository formats them, so that a new folder
 * needs no formatting pass for them.
 */

/** The shared example app, which every example renders. */
export const EXAMPLE_APP = '@react-native-use-dom/example-app'

/**
 * What the template brings for its own `App.tsx`, tests and tooling, which the examples don't
 * use: the root of the repository lints, formats and tests everything.
 */
export const TEMPLATE_PATHS = [
	'.bundle',
	'.eslintrc.js',
	'.prettierrc.js',
	'App.tsx',
	'Gemfile',
	'__tests__',
	'jest.config.js',
]

/** The scripts of the template's `package.json` that run its tests and tooling. */
export const TEMPLATE_SCRIPTS = new Set(['lint', 'test'])

/** The packages of the template's `package.json` that its `App.tsx`, tests and tooling need. */
export const TEMPLATE_PACKAGES = new Set([
	'@react-native/eslint-config',
	'@react-native/jest-preset',
	'@react-native/new-app-screen',
	'@types/jest',
	'@types/react-test-renderer',
	'eslint',
	'jest',
	'prettier',
	'react-test-renderer',
])

export const BABEL_CONFIG = `module.exports = {
	plugins: ['react-native-use-dom/babel'],
	presets: ['module:@react-native/babel-preset'],
}
`

export const METRO_CONFIG = `const path = require('node:path')

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withDom } = require('react-native-use-dom/metro')

const workspaceRoot = path.resolve(__dirname, '..', '..')

// The workspace's packages install their own React Native, and the app's can be another version.
// Two copies in one bundle break it, so these always resolve from the app.
const SINGLETONS = ['react', 'react-dom', 'react-native', 'react-native-nitro-modules', 'react-native-safe-area-context']

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
	resolver: {
		resolveRequest: (context, moduleName, platform) => {
			const isSingleton = SINGLETONS.some((name) => moduleName === name || moduleName.startsWith(name + '/'))

			return context.resolveRequest(
				isSingleton ? { ...context, originModulePath: path.join(__dirname, 'package.json') } : context,
				moduleName,
				platform,
			)
		},
	},
	// The library is linked from the workspace, and its dependencies from the workspace's store.
	watchFolders: [workspaceRoot],
}

module.exports = withDom(mergeConfig(getDefaultConfig(__dirname), config))
`

export const INDEX = `/**
 * @format
 */

import App from '${EXAMPLE_APP}'
import { AppRegistry } from 'react-native'

import { name as appName } from './app.json'

AppRegistry.registerComponent(appName, () => App)
`

export const TSCONFIG = `{
	"extends": "@react-native/typescript-config",
	"include": ["**/*.ts", "**/*.tsx"],
	"exclude": ["**/node_modules", "**/Pods"]
}
`

/**
 * The README of a generated folder.
 *
 * @param {{ bundleId: string, reactNative: string }} cell
 * @returns {string}
 */
export function readme(cell) {
	return `# Bare React Native example, ${cell.reactNative}

The [React Native Community CLI](https://github.com/react-native-community/cli) template for React Native
${cell.reactNative}, without Expo, rendering the shared example app in
[\`e2e/example-app\`](../../e2e/example-app) with \`react-native-use-dom\`. Its bundle id and application id
are \`${cell.bundleId}\`.

\`pnpm e2e:generate:bare\` created this folder. A patch release of React Native only changes the versions in
\`package.json\`.

To run it, follow the [bare example's guide](../bare-0.87/README.md#run-it) from this folder.
`
}
