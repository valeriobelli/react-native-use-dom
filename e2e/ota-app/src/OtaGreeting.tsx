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
 * The DOM component the OTA scenario checks. It reads a value from `localStorage` on mount and
 * reports it, so the flow can verify that storage survives an update. The greeting it renders comes
 * from a prop, so a new JS bundle with a changed greeting is what the update ships.
 */
export default function OtaGreeting({ greeting }: { greeting: string; dom?: DomProps }) {
	// A lazy initializer reads localStorage before the first paint, without an effect.
	const [stored] = useState<string>(() => {
		const existing = domStorage.getItem('ota-test-value')

		if (existing !== null) {
			return existing
		}

		domStorage.setItem('ota-test-value', 'written-before-update')

		return 'written-before-update'
	})

	return (
		<div style={CONTAINER_STYLE}>
			<p>{greeting}</p>
			<p data-testid="storage-value">{stored}</p>
		</div>
	)
}
