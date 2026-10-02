/**
 * Development support for the page a DOM component runs in: Fast Refresh, and build errors shown
 * over the component while an edit does not build.
 *
 * The generated entry imports this module before anything else in development: React Refresh must
 * be in place before React DOM loads, or React DOM never reports to it.
 */
import HMRClient from 'metro-runtime/modules/HMRClient'
import type { HmrError } from 'metro-runtime/modules/HMRClient'
import * as RefreshRuntime from 'react-refresh/runtime'

import { DEV_BUNDLE_URL_ATTRIBUTE, DEV_HOT_PATH } from '../runtime/paths'

const OVERLAY_ID = 'use-dom-hot-error'
const RECONNECT_INTERVAL_MS = 1000

/** The errors that mean the dev server no longer knows this page's bundle, as after a restart. */
const STALE_BUNDLE_ERRORS = new Set(['GraphNotFoundError', 'RevisionNotFoundError'])

interface MetroGlobal {
	__METRO_GLOBAL_PREFIX__?: string
}

installRefreshRuntime()
connect(readBundleUrl())

/**
 * Metro's module system applies an update, then asks the refresh runtime it finds on the global
 * object to re-render. An edit it cannot apply in place reloads the page.
 */
function installRefreshRuntime(): void {
	RefreshRuntime.injectIntoGlobalHook(globalThis)
	// oxlint-disable-next-line no-underscore-dangle
	const prefix = (globalThis as MetroGlobal).__METRO_GLOBAL_PREFIX__ ?? ''

	Object.assign(globalThis, {
		[`${prefix}__ReactRefresh`]: {
			createSignatureFunctionForTransform: RefreshRuntime.createSignatureFunctionForTransform,
			getFamilyByType: RefreshRuntime.getFamilyByType,
			isLikelyComponentType: RefreshRuntime.isLikelyComponentType,
			performFullRefresh() {
				location.reload()
			},
			performReactRefresh() {
				// After an error React cannot recover from, only a fresh page shows the edit.
				if (RefreshRuntime.hasUnrecoverableErrors()) {
					location.reload()

					return
				}

				RefreshRuntime.performReactRefresh()
			},
			register: RefreshRuntime.register,
		},
	})
}

/** The page runs its bundle from a script element that names the URL it was fetched from. */
function readBundleUrl(): string | null {
	const url = document.currentScript?.getAttribute(DEV_BUNDLE_URL_ATTRIBUTE)

	return url ? new URL(url, location.href).toString() : null
}

function connect(bundleUrl: string | null): void {
	// Without its bundle's URL the page cannot tell the dev server what to send it updates for.
	if (!bundleUrl) {
		return
	}

	const socketUrl = new URL(DEV_HOT_PATH, location.href)

	socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
	const client = new HMRClient(socketUrl.toString())
	let connected = false

	client.on('open', () => {
		connected = true
	})

	client.on('update', ({ isInitialUpdate, added, modified, deleted }) => {
		if (!isInitialUpdate && added.length + modified.length + deleted.length > 0) {
			hideError()
		}
	})

	client.on('error', (error) => {
		if (STALE_BUNDLE_ERRORS.has(error.type)) {
			location.reload()

			return
		}

		showError(error)
	})

	client.on('close', () => {
		// A page that never connected is not one a restart disconnected: reloading would not help.
		if (!connected) {
			return
		}

		reloadWhenServerIsBack()
	})

	client.send(JSON.stringify({ entryPoints: [bundleUrl], type: 'register-entrypoints' }))
	client.enable()
}

/** Once the dev server answers again, the page loads the bundle it builds after restarting. */
function reloadWhenServerIsBack(): void {
	setTimeout(() => {
		fetch(location.href, { cache: 'no-store' })
			.then((response) => {
				if (response.ok) {
					location.reload()

					return true
				}

				// The server answered but is not serving this page yet: try again.
				reloadWhenServerIsBack()

				return false
			})
			.catch(() => {
				reloadWhenServerIsBack()
			})
	}, RECONNECT_INTERVAL_MS)
}

/** Shown over the component, which keeps its state underneath for when the edit is fixed. */
function showError(error: HmrError): void {
	const overlay = document.querySelector<HTMLElement>(`#${OVERLAY_ID}`) ?? document.createElement('pre')

	overlay.id = OVERLAY_ID

	overlay.style.cssText =
		'position:fixed;inset:0;z-index:2147483647;margin:0;padding:16px;overflow:auto;white-space:pre-wrap;font:12px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:#b3261e;box-sizing:border-box'
	overlay.textContent = describe(error)
	document.body.append(overlay)
}

function hideError(): void {
	document.querySelector(`#${OVERLAY_ID}`)?.remove()
}

function describe(error: HmrError): string {
	const locations = (error.errors ?? [])
		.filter((entry) => !!entry.filename)
		.map((entry) => `${entry.filename ?? ''}${entry.lineNumber === undefined ? '' : `:${entry.lineNumber}`}`)

	return [error.type, locations.join('\n'), error.message].filter(Boolean).join('\n\n')
}
