'use dom'

import type { DomProps, DomRef } from '../../native'
import { useDOMImperativeHandle } from '../../web'

/** What the native side can do to the greeting through its ref. */
export interface GreetingHandle {
	reset(): void
	getClicks(): number
	rename(name: string): Promise<string>
}

/** A DOM component as an app writes one: its props, a native action, a typed ref and `dom`. */
export default function Greeting(props: {
	name: string
	count?: number
	onClick(clicks: number): Promise<string>
	ref?: DomRef<GreetingHandle>
	dom?: DomProps
}) {
	useDOMImperativeHandle<GreetingHandle>(
		() => ({
			getClicks: () => 0,
			rename: async (name) => name,
			reset: () => {},
		}),
		[],
	)

	return <p>{props.name}</p>
}
