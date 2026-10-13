import { HotUpdater } from '@hot-updater/react-native'
import ExampleApp from '@react-native-use-dom/example-app'
import OtaApp from '@react-native-use-dom/ota-app'
import type { OtaHotUpdater } from '@react-native-use-dom/ota-app'
import { useCallback, useState } from 'react'
import { Button, StyleSheet, View } from 'react-native'

/**
 * The Hot Updater client. `init` configures it; the OTA screen calls `checkForUpdate` and `reload`
 * through the `OtaHotUpdater` interface the shared OTA app expects.
 */
const hotUpdater: OtaHotUpdater = HotUpdater.init({
	baseURL: 'http://localhost:3000/hot-updater',
})

/** The greeting the OTA update changes. The deploy script rewrites this string in the bundle. */
const GREETING = 'Built-in greeting'

/**
 * The root of the OTA host app. It renders the shared example app by default and adds an OTA screen
 * behind a button, so the release and dev flows keep working unchanged. The OTA flow taps the
 * button, runs the scenario, and taps Back to return.
 */
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
				<OtaApp greeting={GREETING} hotUpdater={hotUpdater} />
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

const styles = StyleSheet.create({
	container: { flex: 1 },
	otaButton: { position: 'absolute', right: 16, top: 50 },
})
