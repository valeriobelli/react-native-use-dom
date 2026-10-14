import path from 'node:path'

import { getDefaultConfig } from '@react-native/metro-config'
import type { ConfigT, InputConfigT } from 'metro-config'
import { mergeConfig } from 'metro-config'

/** React Native's Babel preset, as an app's babel.config.js gets it. */
export const RN_BABEL_PRESET = require.resolve('@react-native/babel-preset', {
	paths: [require.resolve('@react-native/metro-config')],
})

/**
 * The workspace's `node_modules`. The package's dependencies are links into the workspace's store,
 * which Metro only follows into folders it watches, so fixtures watch it the way a workspace app
 * watches its workspace.
 *
 * Never the workspace root: it also holds the example apps' native builds and any git worktree
 * checked out inside it. Metro crawls and keeps in memory every file it watches, for each instance a
 * test starts, and millions of them make each instance take minutes and gigabytes to start.
 */
export const WORKSPACE_MODULES = path.resolve(__dirname, '..', '..', '..', '..', '..', 'node_modules')

/**
 * A fixture project's config as Metro loads it, which puts the project root first among the watch
 * folders, with `overrides` over it.
 *
 * The file map cache stays in the project, which a test removes when it ends: Metro would otherwise
 * write one to the OS temp folder for each fixture's random root and never read or remove it.
 */
export function fixtureConfig({
	projectRoot,
	overrides = {},
}: {
	projectRoot: string
	overrides?: InputConfigT
}): ConfigT {
	return mergeConfig(
		getDefaultConfig(projectRoot),
		{
			cacheStores: [],
			fileMapCacheDirectory: projectRoot,
			maxWorkers: 1,
			reporter: { update: () => {} },
			resolver: { useWatchman: false },
			watchFolders: [projectRoot, WORKSPACE_MODULES],
		},
		overrides,
	)
}
