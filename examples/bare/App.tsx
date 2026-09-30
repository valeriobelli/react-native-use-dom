import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import Greeting from './src/Greeting';

const greetingDom = { backgroundColor: '#f2f2f7' };

export default function App() {
	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.screen}>
				<Text style={styles.title}>react-native-use-dom</Text>
				<View style={styles.dom}>
					<Greeting name="React Native" dom={greetingDom} />
				</View>
			</SafeAreaView>
		</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	title: { fontSize: 20, fontWeight: '600', padding: 16 },
	dom: { flex: 1 },
});
