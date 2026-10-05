'use dom'

import { useState } from 'react'
import type { DomProps, DomRef } from 'react-native-use-dom'
import { isDomError, useDOMImperativeHandle } from 'react-native-use-dom/dom'

/** What the app calls through the ref: each method answers with the code of the error it provoked. */
export interface ReporterHandle {
	/** Calls `onProduce`, whose result the app makes unsendable. */
	callProduce(): Promise<string>
	/** Calls `onGone` as the first render received it, after the app stopped passing it. */
	callGone(): Promise<string>
}

interface ReporterProps {
	onProduce: () => Promise<number>
	onGone?: () => Promise<void>
	ref?: DomRef<ReporterHandle>
	dom?: DomProps
}

/** The code of the error a call rejects with, or what it did when it did not reject. */
async function codeOf(call: Promise<unknown> | undefined): Promise<string> {
	try {
		await call
	} catch (error) {
		return isDomError(error) ? error.code : `Not a DomError: ${String(error)}`
	}

	return 'The call did not reject.'
}

/** Provokes the errors that happen on the DOM side and reports their codes to the app. */
export default function Reporter({ onGone, onProduce }: ReporterProps) {
	// The action the first render received: it stays callable after the app stops passing the prop.
	const [firstGone] = useState(() => onGone)

	useDOMImperativeHandle<ReporterHandle>(
		() => ({
			callGone: () => codeOf(firstGone?.()),
			callProduce: () => codeOf(onProduce()),
		}),
		[firstGone, onProduce],
	)

	return <span>Reporter</span>
}
