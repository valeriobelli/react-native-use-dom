const path = require('node:path')

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
