// A deep import, because React Native does not re-export this from its package entry. It is the
// only supported way to tell "loaded from a dev server" apart from "loaded from the app bundle",
// which is a sharper distinction than `__DEV__`: a release-mode reload from Metro is still a dev
// server. Pinned, and covered by the bundler-contract smoke test.
import getDevServer from 'react-native/Libraries/Core/Devtools/getDevServer';

import { DomError, DomErrorCode } from '../runtime/errors';
import { DEV_PAGE_PATH, OFFLINE_ORIGIN } from '../runtime/paths';

export interface DomSourceOptions {
	/** Absolute path of the `'use dom'` module, as the Babel plugin recorded it. */
	filePath: string;
	/**
	 * Name of the pre-built HTML file inside the app bundle, written by the Babel plugin during a
	 * release build. Absent in development, where the page is built on demand.
	 */
	bundleFile?: string;
}

/** Resolves the URL the native view loads for a DOM component. */
export function resolveDomSource(options: DomSourceOptions): string {
	const devServer = getDevServer();
	if (devServer.bundleLoadedFromServer) {
		const query = new URLSearchParams({
			file: options.filePath,
			platform: 'web',
			dev: 'true',
		});
		return `${new URL(DEV_PAGE_PATH, devServer.url).href}?${query.toString()}`;
	}

	if (options.bundleFile === undefined) {
		throw new DomError(
			DomErrorCode.MissingMetroConfig,
			`No pre-built page was found for the DOM component in ${options.filePath}.`,
			{
				fix: "Release builds need `withDom()` applied in metro.config.js, which is what builds the page and embeds it. Wrap your config with `withDom` from 'react-native-use-dom/metro' and rebuild.",
			},
		);
	}

	return `${OFFLINE_ORIGIN}/dom.bundle/${options.bundleFile}`;
}
