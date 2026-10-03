import { Button, StyleSheet, Text, View } from 'react-native'

/**
 * The placeholder for the view options screen, which a later issue fills with one DOM component
 * per `dom` prop option the library supports.
 */
export default function ViewOptions({ onBack }: { onBack: () => void }) {
	return (
		<View style={styles.screen}>
			<Text style={styles.title}>View options</Text>
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
