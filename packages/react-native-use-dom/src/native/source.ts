import type { TurboModule } from 'react-native'
import { Platform, TurboModuleRegistry } from 'react-native'

import { DomError, DomErrorCode } from '../runtime/errors'
import type { NativePlatform } from '../runtime/paths'
import { DEV_PAGE_PATH, OFFLINE_BUNDLE_DIR, OFFLINE_ORIGINS } from '../runtime/paths'

interface SourceCodeSpec extends TurboModule {
	getConstants(): { scriptURL: string }
}

/**
 * Where the running JS bundle came from. This reads what React Native's own dev tools read, through
 * its public module registry rather than a deep import, which React Native deprecates.
 */
function readScriptUrl(): string {
	return TurboModuleRegistry.get<SourceCodeSpec>('SourceCode')?.getConstants().scriptURL ?? ''
}

/**
 * The origin of the dev server the running bundle came from, with a trailing slash, or `null` when
 * it came from the device. That is a sharper distinction than `__DEV__`: a release-mode reload from
 * Metro is still a dev server.
 */
function devServerOrigin({ scriptUrl }: { scriptUrl: string }): string | null {
	return /^https?:\/\/.*?\//u.exec(scriptUrl)?.[0] ?? null
}

/**
 * The pages folder written next to the running bundle, as a URL the native view serves from: a
 * `file://` folder, or an `assets://` one for a bundle inside an Android APK. An over-the-air update
 * runs its own bundle from its own folder, with its own pages beside it, so the pages always come
 * from the same build as the bundle. An empty string when the bundle's location is unknown, which
 * the native view answers as a missing page rather than serving pages from somewhere else.
 */
function pagesDirectoryOf({ scriptUrl }: { scriptUrl: string }): string {
	// Android reports a bundle on device storage as a bare absolute path, with no scheme.
	const url = scriptUrl.startsWith('/') ? `file://${scriptUrl}` : scriptUrl.replace(/[?#].*$/u, '')

	if (!url.startsWith('file:///') && !url.startsWith('assets://')) {
		return ''
	}

	return `${url.slice(0, url.lastIndexOf('/') + 1)}${OFFLINE_BUNDLE_DIR}`
}

export interface DomSourceOptions {
	/** Absolute path of the `'use dom'` module, as the Babel plugin recorded it. */
	filePath: string
	/**
	 * Name of the pre-built HTML file next to the bundle, written by the Babel plugin during a
	 * release build. Absent in development, where the page is built on demand.
	 */
	bundleFile?: string
}

/** What the native view needs to load a DOM component's page. */
export interface DomSource {
	/** The URL the native view loads. */
	source: string
	/**
	 * The folder the native view serves the offline origin from, next to the running bundle. Empty
	 * in development, where the dev server serves the page.
	 */
	pagesDirectory: string
}

/** Resolves the page the native view loads for a DOM component, and the folder it is served from. */
export function resolveDomSource({ bundleFile, filePath }: DomSourceOptions): DomSource {
	const scriptUrl = readScriptUrl()
	const devServer = devServerOrigin({ scriptUrl })

	if (devServer) {
		const query = new URLSearchParams({
			dev: 'true',
			file: filePath,
			platform: 'web',
		})

		return { pagesDirectory: '', source: `${new URL(DEV_PAGE_PATH, devServer).href}?${query.toString()}` }
	}

	if (!bundleFile) {
		throw new DomError(
			DomErrorCode.MissingMetroConfig,
			`No pre-built page was found for the DOM component in ${filePath}.`,
			{
				fix: "Release builds need `withDom()` applied in metro.config.js, which is what builds the page and writes it next to the bundle. Wrap your config with `withDom` from 'react-native-use-dom/metro' and rebuild.",
			},
		)
	}

	return {
		pagesDirectory: pagesDirectoryOf({ scriptUrl }),
		source: `${OFFLINE_ORIGINS[Platform.OS as NativePlatform]}/${OFFLINE_BUNDLE_DIR}/${bundleFile}`,
	}
}
