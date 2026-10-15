'use dom'

import type { DomProps } from 'react-native-use-dom'

import './Field.css'

/** A text field, so that a flow can focus it and show what iOS draws above the keyboard. */
export default function Field({ label }: { label: string; dom?: DomProps }) {
	return (
		<label className="field">
			{label}
			<input id="field-input" type="text" />
		</label>
	)
}
