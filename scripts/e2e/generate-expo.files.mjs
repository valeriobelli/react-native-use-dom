/**
 * The files the Expo generator writes itself, over the template's, and what it takes out of the
 * template. They are kept here, formatted the way the repository formats them, so that a new folder
 * needs no formatting pass for them.
 */

/** The shared example app, which every example renders. */
export const EXAMPLE_APP = '@react-native-use-dom/example-app'

/**
 * What the template brings for its own `App.tsx`, and what `create-expo-app` adds around it: a Git
 * repository of its own would hide the example from this one, and the web favicon belongs to a web
 * target the examples don't have.
 */
export const TEMPLATE_PATHS = ['.git', 'App.tsx', 'LICENSE', 'assets/favicon.png']

/** The packages of the template's `package.json` that its `App.tsx` needs. */
export const TEMPLATE_PACKAGES = new Set(['expo-status-bar'])

export const BABEL_CONFIG = `module.exports = {
	plugins: ['react-native-use-dom/babel'],
	presets: ['babel-preset-expo'],
}
`

export const INDEX = `import App from '${EXAMPLE_APP}'
import { registerRootComponent } from 'expo'

registerRootComponent(App)
`

export const METRO_CONFIG = `const path = require('node:path')

const { getDefaultConfig } = require('expo/metro-config')
const { withDom } = require('react-native-use-dom/metro')

/**
 * Packages the app must hold a single copy of. The library is linked from the workspace, where it
 * is developed against another React Native version than this Expo SDK's, so its imports of these
 * would otherwise reach that version.
 */
const SINGLETONS = new Set(['react', 'react-dom', 'react-native', 'react-native-nitro-modules'])
const APP = path.join(__dirname, 'package.json')

const config = getDefaultConfig(__dirname)

config.resolver.resolveRequest = (context, moduleName, platform) => {
	const [packageName] = moduleName.split('/')
	const origin = SINGLETONS.has(packageName) ? { originModulePath: APP } : {}

	return context.resolveRequest({ ...context, ...origin }, moduleName, platform)
}

module.exports = withDom(config)
`

/**
 * The README of a generated folder.
 *
 * @param {{ bundleId: string, expo: string, reactNative: string }} cell
 * @returns {string}
 */
export function readme(cell) {
	return `# Expo example, SDK ${cell.expo.split('.')[0]}

An [Expo](https://docs.expo.dev) app on \`expo\` ${cell.expo}, which ships React Native ${cell.reactNative}, rendering the
shared example app in [\`e2e/example-app\`](../../e2e/example-app) with \`react-native-use-dom\`. Its bundle id and
application id are \`${cell.bundleId}\`.

\`pnpm e2e:generate:expo\` created this folder. It uses
[Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/): only JavaScript and
\`app.json\` are committed, and \`expo prebuild\` generates \`ios\` and \`android\`. A patch release of Expo only changes the
versions in \`package.json\`.

To run it, follow the [Expo example's guide](../expo-57/README.md) from this folder.
`
}
