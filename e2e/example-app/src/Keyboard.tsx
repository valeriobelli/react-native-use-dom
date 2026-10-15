import { useMemo, useState } from 'react'
import { Button, StyleSheet, Switch, Text, View } from 'react-native'

import Field from './keyboard/Field'

/** One field whose keyboard accessory bar a switch turns on and off, without remounting the field. */
export default function Keyboard({ onBack }: { onBack: () => void }) {
	const [hidden, setHidden] = useState(false)
	const dom = useMemo(() => ({ hideKeyboardAccessoryView: hidden }), [hidden])

	return (
		<View style={styles.screen}>
			<View style={styles.header}>
				<Text style={styles.title}>Keyboard</Text>
				<Button testID="back" title="Back" onPress={onBack} />
			</View>
			<View style={styles.toggle}>
				<Text>Hide the keyboard accessory bar</Text>
				<Switch testID="hide-accessory" value={hidden} onValueChange={setHidden} />
			</View>
			<View testID="field" style={styles.field}>
				<Field label="Focus me" dom={dom} />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	field: { height: 120, marginHorizontal: 16 },
	header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	screen: { flex: 1 },
	title: { fontSize: 20, fontWeight: '600', paddingHorizontal: 16 },
	toggle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
})
