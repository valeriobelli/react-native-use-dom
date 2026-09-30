import type { TurboModule } from 'react-native';
import { Platform, TurboModuleRegistry } from 'react-native';

import { DomError, DomErrorCode } from '../runtime/errors';
import type { NativePlatform } from '../runtime/paths';
import { DEV_PAGE_PATH, OFFLINE_BUNDLE_DIR, OFFLINE_ORIGINS } from '../runtime/paths';

interface SourceCodeSpec extends TurboModule {
	getConstants(): { scriptURL: string };
}

/**
 * The origin of the dev server the running bundle came from, with a trailing slash, or `null` when
 * it came from the app binary. That is a sharper distinction than `__DEV__`: a release-mode reload
 * from Metro is still a dev server. This reads what React Native's own dev tools read, through its
 * public module registry rather than a deep import, which React Native deprecates.
 */
function devServerOrigin(): string | null {
	const scriptUrl = TurboModuleRegistry.get<SourceCodeSpec>('SourceCode')?.getConstants().scriptURL ?? '';
	return /^https?:\/\/.*?\//u.exec(scriptUrl)?.[0] ?? null;
}

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
	const devServer = devServerOrigin();
	if (devServer !== null) {
		const query = new URLSearchParams({
			file: options.filePath,
			platform: 'web',
			dev: 'true',
		});
		return `${new URL(DEV_PAGE_PATH, devServer).href}?${query.toString()}`;
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

	return `${OFFLINE_ORIGINS[Platform.OS as NativePlatform]}/${OFFLINE_BUNDLE_DIR}/${options.bundleFile}`;
}
