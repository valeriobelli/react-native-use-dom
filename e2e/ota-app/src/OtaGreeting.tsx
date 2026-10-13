'use dom'

import { useState } from 'react'
import type { DomProps } from 'react-native-use-dom'

/** The storage a DOM component's page has, which the React Native tsconfig does not type. */
interface DomStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
}

/** `localStorage` is a browser global the React Native tsconfig does not declare. */
const domStorage = (globalThis as unknown as { localStorage: DomStorage }).localStorage

/** The style of the greeting container, kept out of the render to avoid a new object as a prop. */
const CONTAINER_STYLE = { font: '16px system-ui', padding: 8 }

/**
 * The DOM component the OTA scenario checks. The greeting it renders comes from a prop, so a new JS
 * bundle with a changed greeting is what the update ships. The page stamp lives in this module, so
 * the deploy changes the page's own bytes: an update that serves the old page fails the flow even
 * though the prop came from the new bundle.
 *
 * `storageSeed` writes the sentinel to `localStorage` when the store is empty, and only the
 * built-in build passes it: the deploy removes it from the update, whose page only reads. A store
 * the update lost therefore reads back empty and the flow's assertion fails, instead of the page
 * silently re-seeding it.
 */
const PAGE_STAMP = 'page a'

/** The key the OTA scenario reads and writes. */
const STORAGE_KEY = 'ota-test-value'

export default function OtaGreeting({
	greeting,
	storageSeed,
}: {
	greeting: string
	storageSeed?: string
	dom?: DomProps
}) {
	// A lazy initializer reads localStorage before the first paint, without an effect. The seed
	// writes only when the store is empty, so a read of an existing value is never overwritten.
	const [stored] = useState<string>(() => {
		const existing = domStorage.getItem(STORAGE_KEY)

		if (existing) {
			return existing
		}

		if (storageSeed) {
			domStorage.setItem(STORAGE_KEY, storageSeed)

			return storageSeed
		}

		return ''
	})

	return (
		<div style={CONTAINER_STYLE}>
			<p>{greeting}</p>
			<p data-testid="storage-value">{stored}</p>
			<p data-testid="page-stamp">{PAGE_STAMP}</p>
		</div>
	)
}
