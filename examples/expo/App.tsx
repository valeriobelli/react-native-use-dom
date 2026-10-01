import { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { DomRefHandle } from 'react-native-use-dom';

import type { GreetingHandle } from './src/Greeting';
import Greeting from './src/Greeting';
import Note from './src/Note';

const greetingDom = { backgroundColor: '#f2f2f7' };

export default function App() {
	const greeting = useRef<DomRefHandle<GreetingHandle>>(null);
	const [status, setStatus] = useState('Not clicked yet.');

	// Runs natively when the DOM component calls it, and answers back to it.
	const onClick = useCallback((clicks: number) => {
		setStatus(`The DOM component reported ${clicks} clicks.`);
		return Promise.resolve(clicks % 2 === 0 ? 'Even.' : 'Odd.');
	}, []);

	// A DOM component never leaves its page: the app decides where a link goes.
	const noteDom = useMemo(
		() => ({
			matchContents: true,
			onNavigationBlocked: (url: string) => {
				setStatus(`Opened ${url} outside the DOM component.`);
				void Linking.openURL(url);
			},
		}),
		[],
	);

	const reset = useCallback(async () => {
		const clicks = await greeting.current?.getClicks();
		await greeting.current?.reset();
		setStatus(`Reset after ${clicks ?? 0} clicks.`);
	}, []);

	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.screen}>
				<Text style={styles.title}>react-native-use-dom</Text>
				<Note text="This paragraph is a DOM component, sized to its text." dom={noteDom} />
				<View style={styles.dom}>
					<Greeting ref={greeting} name="React Native" onClick={onClick} dom={greetingDom} />
				</View>
				<Text style={styles.status}>{status}</Text>
				<Button title="Reset the counter" onPress={reset} />
			</SafeAreaView>
		</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	title: { fontSize: 20, fontWeight: '600', padding: 16 },
	dom: { flex: 1 },
	status: { padding: 16 },
});
