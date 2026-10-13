import { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'

import OtaGreeting from './src/OtaGreeting'

/** The DOM props the OTA greeting uses, stable across renders. */
const DOM_PROPS = { matchContents: true, scrollEnabled: false }

/**
 * The screen the OTA host apps render. It shows the DOM component with a greeting that changes
 * between builds, and a button that checks for an update through Hot Updater. The flow deploys an
 * update that changes the greeting, restarts the app, and verifies the new text renders and
 * `localStorage` survives.
 */
export default function OtaApp({ greeting, hotUpdater }: { greeting: string; hotUpdater: OtaHotUpdater }) {
	const [status, setStatus] = useState('')

	const checkForUpdate = useCallback(() => {
		setStatus('Checking…')

		void (async () => {
			try {
				const update = await hotUpdater.checkForUpdate({ updateStrategy: 'appVersion' })

				if (!update) {
					setStatus('Up to date')

					return
				}

				setStatus('Downloading…')
				const downloaded = await update.updateBundle()

				if (!downloaded) {
					setStatus('Download failed')

					return
				}

				setStatus('Reloading…')
				await hotUpdater.reload()
			} catch (error) {
				setStatus(`Error: ${(error as Error).message}`)
			}
		})()
	}, [hotUpdater])

	return (
		<View style={styles.screen}>
			<Text style={styles.title}>OTA</Text>
			<OtaGreeting greeting={greeting} dom={DOM_PROPS} />
			<Text testID="ota-status">{status}</Text>
			<Button testID="ota-check" title="Check for update" onPress={checkForUpdate} />
		</View>
	)
}

/** The Hot Updater API the host app wires in. */
export interface OtaHotUpdater {
	checkForUpdate(options: { updateStrategy: 'appVersion' | 'fingerprint' }): Promise<{
		updateBundle(): Promise<boolean>
		shouldForceUpdate: boolean
	} | null>
	reload(): Promise<void>
}

const styles = StyleSheet.create({
	screen: { flex: 1, padding: 16 },
	title: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
})
