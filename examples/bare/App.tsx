import { useCallback, useMemo, useRef, useState } from 'react'
import { Button, Linking, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import type { DomRefHandle } from 'react-native-use-dom'

import type { GreetingHandle } from './src/Greeting'
import Greeting from './src/Greeting'
import Lines from './src/Lines'
import Note from './src/Note'

const greetingDom = { backgroundColor: '#f2f2f7' }
const NAMES = ['React Native', 'Metro'] as const

/** The state the screen shows, and the callbacks its DOM components and buttons run. */
function useDemo() {
	const first = useRef<DomRefHandle<GreetingHandle>>(null)
	const [status, setStatus] = useState('Not clicked yet.')
	const [name, setName] = useState<(typeof NAMES)[number]>(NAMES[0])

	// Run natively when a DOM component calls them, and answer back to it.
	const onClick = useMemo(() => {
		const report = (greeting: string) => (clicks: number) => {
			setStatus(`The ${greeting} greeting reported ${clicks} clicks.`)
			return Promise.resolve(clicks % 2 === 0 ? 'Even.' : 'Odd.')
		}
		return { first: report('first'), second: report('second') }
	}, [])

	// A DOM component never leaves its page: the app decides where a link goes.
	const noteDom = useMemo(
		() => ({
			matchContents: true,
			onNavigationBlocked: (url: string) => {
				setStatus(`Opened ${url} outside the DOM component.`)
				void Linking.openURL(url)
			},
		}),
		[],
	)

	// The ref reaches the first greeting only: the second keeps its count.
	const reset = useCallback(async () => {
		const clicks = await first.current?.getClicks()
		await first.current?.reset()
		setStatus(`Reset the first greeting after ${clicks ?? 0} clicks.`)
	}, [])

	// A new prop reaches the page without reloading it: the counts survive.
	const rename = useCallback(() => {
		setName((current) => (current === NAMES[0] ? NAMES[1] : NAMES[0]))
	}, [])

	return { first, status, name, onClick, noteDom, reset, rename }
}

export default function App() {
	const { first, status, name, onClick, noteDom, reset, rename } = useDemo()

	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.screen}>
				<Text style={styles.title}>react-native-use-dom</Text>
				<View testID="note">
					<Note text="This note is a DOM component, sized to its text." dom={noteDom} />
				</View>
				<View testID="first-greeting" style={styles.greeting}>
					<Greeting ref={first} name={name} onClick={onClick.first} dom={greetingDom} />
				</View>
				<View testID="second-greeting" style={styles.greeting}>
					<Greeting name="a second instance" onClick={onClick.second} dom={greetingDom} />
				</View>
				<Text testID="status" style={styles.status}>
					{status}
				</Text>
				<View style={styles.buttons}>
					<Button title="Reset the first" onPress={reset} />
					<Button title={`Rename to ${name === NAMES[0] ? NAMES[1] : NAMES[0]}`} onPress={rename} />
				</View>
				<View testID="lines" style={styles.lines}>
					<Lines count={40} />
				</View>
			</SafeAreaView>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	title: { fontSize: 20, fontWeight: '600', padding: 16 },
	greeting: { height: 56, marginHorizontal: 16, marginBottom: 8 },
	status: { padding: 16 },
	buttons: { flexDirection: 'row', justifyContent: 'space-around' },
	lines: { flex: 1 },
})
