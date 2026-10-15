import { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import Demo from './src/Demo'
import Errors from './src/Errors'
import Keyboard from './src/Keyboard'
import ViewOptions from './src/ViewOptions'

type Screen = 'demo' | 'errors' | 'viewOptions' | 'keyboard'

export default function App() {
	const [screen, setScreen] = useState<Screen>('demo')

	const openErrors = useCallback(() => {
		setScreen('errors')
	}, [])

	const openViewOptions = useCallback(() => {
		setScreen('viewOptions')
	}, [])

	const openKeyboard = useCallback(() => {
		setScreen('keyboard')
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
					<Button testID="open-keyboard" title="Keyboard" onPress={openKeyboard} />
				</View>
				{screen === 'demo' && <Demo />}
				{screen === 'errors' && <Errors onBack={back} />}
				{screen === 'viewOptions' && <ViewOptions onBack={back} />}
				{screen === 'keyboard' && <Keyboard onBack={back} />}
			</SafeAreaView>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	navigation: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
	screen: { flex: 1 },
	title: { fontSize: 20, fontWeight: '600', padding: 16 },
})
