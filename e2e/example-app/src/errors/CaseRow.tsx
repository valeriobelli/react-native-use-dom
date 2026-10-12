import type { ReactNode } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { isDomError } from 'react-native-use-dom'

/** What a result shows before its button is pressed. */
export const NOT_RUN = 'Not run yet.'

/**
 * The code of an error, which is all a case shows. Anything that is not a `DomError` is shown by its
 * message, so the flow fails on it instead of passing on a wrong error.
 */
export function describeError(error: unknown): string {
	if (isDomError(error)) {
		return error.code
	}

	return `Not a DomError: ${String(error)}`
}

/** The ids of a case: the code in kebab case, without its prefix. */
function caseIds(code: string) {
	const name = code.replace('ERR_USE_DOM_', '').toLowerCase().replaceAll('_', '-')

	return { button: `error-${name}`, result: `error-${name}-result`, title: name.replaceAll('-', ' ') }
}

interface CaseRowProps {
	code: string
	/** What the button does. */
	onPress: () => void
	result: string
	/** The DOM component the case needs, if it needs one on screen. */
	children?: ReactNode
}

/** One case: a native button, the text its error's code goes to, and the host of the case. */
export function CaseRow({ children, code, onPress, result }: CaseRowProps) {
	const ids = caseIds(code)

	return (
		<View style={styles.row}>
			<Button testID={ids.button} title={ids.title} onPress={onPress} />
			<Text testID={ids.result} style={styles.result}>
				{result}
			</Text>
			{children}
		</View>
	)
}

const styles = StyleSheet.create({
	result: { paddingVertical: 4 },
	row: { paddingVertical: 8 },
})
