'use dom'

import type { DomProps } from 'react-native-use-dom'

import './Tall.css'

/** Content far taller than the view the app gives it, so that only `scrollEnabled` decides if it scrolls. */
export default function Tall({ count }: { count: number; dom?: DomProps }) {
	const rows = Array.from({ length: count }, (_, index) => `Row ${index + 1} of the tall page.`)

	return (
		<ol className="tall">
			{rows.map((row) => (
				<li key={row}>{row}</li>
			))}
		</ol>
	)
}
