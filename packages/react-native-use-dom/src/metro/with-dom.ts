import type { ConfigT, InputConfigT } from 'metro-config';

import { readBundleCommand } from './bundle-command';
import type { Middleware } from './dev-middleware';
import { createDomDevServer } from './dev-middleware';
import type { Metro } from './host-metro';
import { hostMetro } from './host-metro';
import { withReleaseBuild } from './release-build';

/** A Metro config as `metro.config.js` can export it. */
export type MetroConfigInput = InputConfigT | ConfigT;

/** A `metro.config.js` export Metro calls with its defaults. */
export type MetroConfigFunction = (defaults: ConfigT) => MetroConfigInput | Promise<MetroConfigInput>;

type EnhanceMiddleware = NonNullable<ConfigT['server']['enhanceMiddleware']>;
type MetroServer = Parameters<EnhanceMiddleware>[1];

/**
 * Adds DOM components to a Metro config.
 *
 * Wrap the config `metro.config.js` exports, whichever way it is built: React Native's
 * `getDefaultConfig`, Expo's, or your own. Everything the config already does is kept, including
 * an existing `server.enhanceMiddleware`, which keeps running for every request that is not for a
 * DOM component.
 *
 * During development, the dev server also serves DOM component pages, from the same port. They are
 * built from your config, so resolver customisations (`resolveRequest`, `extraNodeModules`,
 * `blockList`, `watchFolders`) apply to them too.
 *
 * Release builds — `react-native bundle`, and the Xcode and Gradle builds that run it — also build
 * every DOM component the app renders and embed its page with the bundle, so the app loads it
 * without a network connection. An existing `serializer.customSerializer` keeps producing the
 * native bundle.
 *
 * Metro accepts the returned Promise (or function) as a `metro.config.js` export as it is.
 *
 * @param config - The config to extend: an object, a Promise of one, or a function Metro calls with
 *   its defaults.
 * @returns The same config with DOM components enabled, in the form Metro loads it.
 *
 * @example
 * ```js
 * // metro.config.js
 * const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
 * const { withDom } = require('react-native-use-dom/metro');
 *
 * module.exports = withDom(mergeConfig(getDefaultConfig(__dirname), {}));
 * ```
 */
export function withDom(config: MetroConfigInput | Promise<MetroConfigInput>): Promise<MetroConfigInput>;
export function withDom(config: MetroConfigFunction): MetroConfigFunction;
export function withDom(
	config: MetroConfigInput | Promise<MetroConfigInput> | MetroConfigFunction,
): Promise<MetroConfigInput> | MetroConfigFunction {
	if (typeof config === 'function') {
		return async (defaults) => addDom(await config(defaults));
	}
	return Promise.resolve(config).then(addDom);
}

function addDom(config: MetroConfigInput): MetroConfigInput {
	const enhanceMiddleware = config.server?.enhanceMiddleware;
	// The config as Metro resolves it: what the project exported, over Metro's own defaults.
	const resolveConfig = async (metro: Metro, projectRoot: string): Promise<ConfigT> =>
		metro.mergeConfig(await metro.getDefaultConfig(projectRoot), config as InputConfigT);

	// The dev server serializes bundles the same way, and leaves the pages to its own routes.
	const command = readBundleCommand(process.argv);

	return {
		...config,
		...(command && {
			serializer: {
				...config.serializer,
				customSerializer: withReleaseBuild(config.serializer?.customSerializer, resolveConfig, command),
			},
		}),
		server: {
			...config.server,
			enhanceMiddleware: (middleware, metroServer) => {
				const rest = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
				return withDomRoutes(rest as Middleware, metroServer);
			},
		},
	};
}

/**
 * The DOM routes answer first, and everything else reaches the middleware they wrap.
 *
 * The web bundler is configured from the config the dev server runs with, rather than the one
 * `metro.config.js` exported: that is the one command-line options (`--reset-cache`, `--port`,
 * watch folders) have already been applied to.
 *
 * The web bundler stops with the dev server: every way Metro shuts a server down ends it through
 * `end()`, and Metro has no other shutdown hook.
 */
function withDomRoutes(rest: Middleware, metroServer: MetroServer): Middleware {
	// Metro exposes the config a server runs with only through this field.
	// oxlint-disable-next-line no-underscore-dangle
	const dom = createDomDevServer(metroServer._config, hostMetro(metroServer));
	const end = metroServer.end.bind(metroServer);
	metroServer.end = async () => {
		await Promise.all([end(), dom.close()]);
	};
	return (req, res, next) => {
		dom.middleware(req, res, (error) => {
			if (error === undefined || error === null) rest(req, res, next);
			else next(error);
		});
	};
}
