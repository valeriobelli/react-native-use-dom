import { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import Demo from './src/Demo'
import Errors from './src/Errors'
import ViewOptions from './src/ViewOptions'

/** The screens the example app shows: the demo, and the two pages later issues fill in. */
type Screen = 'demo' | 'errors' | 'viewOptions'

/** The screens the example apps render: the demo, plus the two pages later issues fill in. */
export default function App() {
	const [screen, setScreen] = useState<Screen>('demo')

	const openErrors = useCallback(() => {
		setScreen('errors')
	}, [])

	const openViewOptions = useCallback(() => {
		setScreen('viewOptions')
	}, [])

	const back = useCallback(() => {
		setScreen('demo')
	}, [])

	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.screen}>
				<Text style={styles.title}>react-native-use-dom</Text>
				<View style={styles.navigation}>
					<Button testID="open-errors" title="Errors" onPress={openErrors} />
					<Button testID="open-view-options" title="View options" onPress={openViewOptions} />
				</View>
				{screen === 'demo' && <Demo />}
				{screen === 'errors' && <Errors onBack={back} />}
				{screen === 'viewOptions' && <ViewOptions onBack={back} />}
			</SafeAreaView>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	navigation: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
	screen: { flex: 1 },
	title: { fontSize: 20, fontWeight: '600', padding: 16 },
})
