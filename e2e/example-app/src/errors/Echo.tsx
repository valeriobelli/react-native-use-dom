'use dom'

import type { DomProps, DomRef } from 'react-native-use-dom'
import { useDOMImperativeHandle } from 'react-native-use-dom/dom'

/** What the app calls through the ref: a method that answers, and one that never does. */
export interface EchoHandle {
	/** Takes any value, so the app can pass one the library refuses. */
	echo(value: unknown): null
	/** Stays pending until the component goes away. */
	hang(): Promise<void>
}

/** Exposes two methods and renders a label. */
// oxlint-disable-next-line no-unused-vars -- the props only give the component its type
export default function Echo(_: { ref?: DomRef<EchoHandle>; dom?: DomProps }) {
	useDOMImperativeHandle<EchoHandle>(
		() => ({
			echo: () => null,
			hang: () =>
				new Promise<void>(() => {
					// Never settles.
				}),
		}),
		[],
	)

	return <span>Echo</span>
}
