// Type tests: checked by `pnpm typecheck`, never run. Each `@ts-expect-error` must flag a real error.
import { useRef } from 'react'

import type { DomComponent, DomRefHandle } from '../../native'
import type { GreetingHandle } from './Greeting'
import Greeting from './Greeting'

const onClick = async (clicks: number): Promise<string> => `clicked ${clicks}`

export function PropsFlowToNativeUsage() {
	return (
		<>
			<Greeting name="dom" onClick={onClick} />
			<Greeting name="dom" count={2} onClick={onClick} />
			{/* @ts-expect-error a prop of the wrong type */}
			<Greeting name={1} onClick={onClick} />
			{/* @ts-expect-error a required prop left out */}
			<Greeting onClick={onClick} />
			{/* @ts-expect-error a prop the component does not declare */}
			<Greeting name="dom" onClick={onClick} colour="red" />
			{/* @ts-expect-error an action that answers with the wrong type */}
			<Greeting name="dom" onClick={async (clicks: number) => clicks} />
		</>
	)
}

export function DomOptionsAreTyped() {
	return (
		<>
			<Greeting
				name="dom"
				onClick={onClick}
				dom={{
					matchContents: true,
					scrollEnabled: false,
					backgroundColor: 'transparent',
					style: { height: 120 },
					testID: 'greeting',
					onNavigationBlocked: (url) => url.startsWith('https:'),
					onLoad: () => {},
					onError: (error) => error.message,
				}}
			/>
			{/* @ts-expect-error an option of the wrong type */}
			<Greeting name="dom" onClick={onClick} dom={{ matchContents: 'yes' }} />
			{/* @ts-expect-error an option that does not exist */}
			<Greeting name="dom" onClick={onClick} dom={{ zoom: 2 }} />
			{/* @ts-expect-error a callback with the wrong parameter */}
			<Greeting name="dom" onClick={onClick} dom={{ onNavigationBlocked: (url: number) => url }} />
		</>
	)
}

export function RefIsTheAsyncHandle() {
	const greeting = useRef<DomRefHandle<GreetingHandle>>(null)
	return <Greeting ref={greeting} name="dom" onClick={onClick} />
}

export function callTheHandle(handle: DomRefHandle<GreetingHandle>): void {
	const clicks: Promise<number> = handle.getClicks()
	// A method that returns nothing resolves with `null`.
	const reset: Promise<null> = handle.reset()
	const renamed: Promise<string> = handle.rename('web')
	// @ts-expect-error every call crosses into the WebView, so it is asynchronous
	const sync: number = handle.getClicks()
	// @ts-expect-error arguments keep their types
	void handle.rename(1)
	// @ts-expect-error the handle has only the methods the component exposes
	void handle.focus()
	void [clicks, reset, renamed, sync]
}

export function RefOfAnotherHandleIsRejected() {
	const other = useRef<DomRefHandle<{ play(): void }>>(null)
	// @ts-expect-error a ref for a handle the component does not expose
	return <Greeting ref={other} name="dom" onClick={onClick} />
}

declare const Chart: DomComponent<{ points: readonly number[] }, { zoom(level: number): Promise<null> }>

export function DomComponentDescribesTheNativeSide() {
	return (
		<>
			<Chart points={[1, 2]} dom={{ matchContents: true }} />
			{/* @ts-expect-error a prop of the wrong type */}
			<Chart points={['1']} />
		</>
	)
}
