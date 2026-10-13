import { HotUpdater } from '@hot-updater/react-native'
import ExampleApp from '@react-native-use-dom/example-app'
import OtaApp from '@react-native-use-dom/ota-app'
import type { OtaHotUpdater } from '@react-native-use-dom/ota-app'
import { registerRootComponent } from 'expo'
import { useCallback, useState } from 'react'
import { Button, StyleSheet, View } from 'react-native'

const hotUpdater: OtaHotUpdater = HotUpdater.init({
	baseURL: 'http://localhost:3000/hot-updater',
})

const GREETING = 'Built-in greeting'

export default function Root() {
	const [screen, setScreen] = useState<'example' | 'ota'>('example')

	const openOta = useCallback(() => {
		setScreen('ota')
	}, [])

	const back = useCallback(() => {
		setScreen('example')
	}, [])

	if (screen === 'ota') {
		return (
			<View style={styles.container}>
				<OtaApp greeting={GREETING} storageSeed="written-before-update" hotUpdater={hotUpdater} />
				<Button testID="ota-back" title="Back" onPress={back} />
			</View>
		)
	}

	return (
		<View style={styles.container}>
			<ExampleApp />
			<View style={styles.otaButton}>
				<Button testID="open-ota" title="OTA" onPress={openOta} />
			</View>
		</View>
	)
}

registerRootComponent(Root)

const styles = StyleSheet.create({
	container: { flex: 1 },
	otaButton: { position: 'absolute', right: 16, top: 50 },
})
