'use dom'

import type { DomProps } from 'react-native-use-dom'

import './Caption.css'

/**
 * A line of text on a page with no background of its own, so that what shows behind it is the
 * view's `backgroundColor`: the one the app gives, or the native view under a transparent one.
 */
export default function Caption({ text }: { text: string; dom?: DomProps }) {
	return <p className="caption">{text}</p>
}
