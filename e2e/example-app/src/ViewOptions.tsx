import { useMemo, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'

import Caption from './view-options/Caption'
import Tall from './view-options/Tall'

const transparentDom = { backgroundColor: 'transparent' }
const noScrollDom = { scrollEnabled: false }
const fixedHeightDom = { backgroundColor: '#d1e7ff', style: { height: 120 } }

/**
 * One DOM component per `dom` prop option that the demo screen doesn't cover: `onLoad`, a
 * transparent `backgroundColor`, `scrollEnabled` and a fixed `style` height. Each sits in a native
 * view with a `testID`, so that a flow can crop its screenshots to it.
 */
export default function ViewOptions({ onBack }: { onBack: () => void }) {
	const [status, setStatus] = useState('Waiting for the first paint.')
	const onLoadDom = useMemo(
		() => ({
			onLoad: () => {
				setStatus('Loaded')
			},
		}),
		[],
	)

	return (
		<View style={styles.screen}>
			<View style={styles.header}>
				<Text style={styles.title}>View options</Text>
				<Button testID="back" title="Back" onPress={onBack} />
			</View>
			<Text testID="onload-status" style={styles.status}>
				{status}
			</Text>
			<View testID="onload" style={styles.onload}>
				<Caption text="onLoad: reports the first paint." dom={onLoadDom} />
			</View>
			<View testID="transparent" style={styles.transparent}>
				<Caption text="backgroundColor: transparent." dom={transparentDom} />
			</View>
			<View testID="no-scroll" style={styles.noScroll}>
				<Tall count={30} dom={noScrollDom} />
			</View>
			<View testID="fixed-height" style={styles.fixedHeight}>
				<Caption text="style: { height: 120 }." dom={fixedHeightDom} />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	fixedHeight: { marginHorizontal: 16, marginTop: 8 },
	header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	noScroll: { height: 96, marginHorizontal: 16, marginTop: 8 },
	onload: { height: 56, marginHorizontal: 16 },
	screen: { flex: 1 },
	status: { paddingHorizontal: 16, paddingVertical: 8 },
	title: { fontSize: 20, fontWeight: '600', paddingHorizontal: 16 },
	transparent: { backgroundColor: '#ffd60a', height: 56, marginHorizontal: 16, marginTop: 8 },
})
