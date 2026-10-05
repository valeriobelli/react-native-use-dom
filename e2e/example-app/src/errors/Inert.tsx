'use dom'

import type { DomProps } from 'react-native-use-dom'

/**
 * Renders nothing the cases look at: the native side renders it with values the library refuses, so
 * its props are typed loosely.
 */
// oxlint-disable-next-line no-unused-vars -- the props only give the component its type
export default function Inert(_: { value?: unknown; config?: Record<string, unknown>; dom?: DomProps }) {
	return <span>Inert</span>
}
