const path = require('node:path')

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withDom } = require('react-native-use-dom/metro')

const workspaceRoot = path.resolve(__dirname, '..', '..')

// The workspace's packages install their own React Native, and the app's can be another version.
// Two copies in one bundle break it, so these always resolve from the app.
const SINGLETONS = [
	'react',
	'react-dom',
	'react-native',
	'react-native-nitro-modules',
	'react-native-safe-area-context',
]

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
