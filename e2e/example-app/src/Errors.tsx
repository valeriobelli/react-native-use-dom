import { Button, StyleSheet, Text, View } from 'react-native'

/**
 * The placeholder for the errors screen, which a later issue fills with one button per runtime
 * error the library can raise.
 */
export default function Errors({ onBack }: { onBack: () => void }) {
	return (
		<View style={styles.screen}>
			<Text style={styles.title}>Errors</Text>
			<Text style={styles.text}>Coming soon.</Text>
			<View style={styles.back}>
				<Button testID="back" title="Back" onPress={onBack} />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	back: { marginTop: 24 },
	screen: { flex: 1, padding: 16 },
	text: { paddingVertical: 8 },
	title: { fontSize: 20, fontWeight: '600' },
})
