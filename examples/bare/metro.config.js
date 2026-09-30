const path = require('node:path');

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withDom } = require('react-native-use-dom/metro');

const workspaceRoot = path.resolve(__dirname, '..', '..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
	// The library is linked from the workspace, and its dependencies from the workspace's store.
	watchFolders: [workspaceRoot],
};

module.exports = withDom(mergeConfig(getDefaultConfig(__dirname), config));
