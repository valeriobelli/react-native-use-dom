import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import { DomErrorCode, isDomError } from 'react-native-use-dom'
import type { DomProps, DomRefHandle } from 'react-native-use-dom'

import Echo from './errors/Echo'
import type { EchoHandle } from './errors/Echo'
import Inert from './errors/Inert'
import Reporter from './errors/Reporter'
import type { ReporterHandle } from './errors/Reporter'

/** What a result shows before its button is pressed. */
const NOT_RUN = 'Not run yet.'

/** Does nothing. */
function noop() {}

/** The DOM components of this screen are only hosts for a call: a small strip is enough. */
const HOST_STYLE = { height: 24 }

/**
 * The code of an error, which is all a case shows. Anything that is not a `DomError` is shown by its
 * message, so the flow fails on it instead of passing on a wrong error.
 */
function describeError(error: unknown): string {
	if (isDomError(error)) {
		return error.code
	}

	return `Not a DomError: ${String(error)}`
}

/** The ids of a case: the code in kebab case, without its prefix. */
function caseIds(code: string) {
	const name = code.replace('ERR_USE_DOM_', '').toLowerCase().replaceAll('_', '-')

	return { button: `error-${name}`, result: `error-${name}-result`, title: name.replaceAll('-', ' ') }
}

interface CaseRowProps {
	code: string
	/** What the button does. */
	onPress: () => void
	result: string
	/** The DOM component the case needs, if it needs one on screen. */
	children?: ReactNode
}

/** One case: a native button, the text its error's code goes to, and the host of the case. */
function CaseRow({ children, code, onPress, result }: CaseRowProps) {
	const ids = caseIds(code)

	return (
		<View style={styles.row}>
			<Button testID={ids.button} title={ids.title} onPress={onPress} />
			<Text testID={ids.result} style={styles.result}>
				{result}
			</Text>
			{children}
		</View>
	)
}

/** A promise with the function that settles it from outside. */
function createDeferred() {
	const deferred = { resolve: noop }
	const promise = new Promise<void>((done) => {
		deferred.resolve = done
	})

	return {
		promise,
		resolve: () => {
			deferred.resolve()
		},
	}
}

/**
 * Tells when a DOM component has loaded, since a call made before that has nowhere to go. `restart`
 * is for a component that is mounted again.
 */
function useLoaded() {
	const deferred = useRef(createDeferred())
	const onLoad = useCallback(() => {
		deferred.current.resolve()
	}, [])
	const restart = useCallback(() => {
		deferred.current = createDeferred()
	}, [])
	const loaded = useCallback(() => deferred.current.promise, [])
	const dom = useMemo<DomProps>(() => ({ onLoad, style: HOST_STYLE }), [onLoad])

	return { dom, loaded, restart }
}

/** Reports the error a child throws while it renders, which no Promise or `dom.onError` can see. */
class CatchRender extends Component<{ children: ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
	override state = { failed: false }

	static getDerivedStateFromError() {
		return { failed: true }
	}

	override componentDidCatch(error: unknown) {
		this.props.onError(error)
	}

	override render() {
		return this.state.failed ? null : this.props.children
	}
}

/** A case that happens when a DOM component is rendered. */
function RenderCase({ code, element }: { code: string; element: ReactNode }) {
	const [shown, setShown] = useState(false)
	const [result, setResult] = useState(NOT_RUN)
	const show = useCallback(() => {
		setShown(true)
	}, [])
	const fail = useCallback((error: unknown) => {
		setResult(describeError(error))
	}, [])

	return (
		<CaseRow code={code} onPress={show} result={result}>
			<CatchRender onError={fail}>{shown ? element : null}</CatchRender>
		</CaseRow>
	)
}

/** A case that happens when the app calls a method of a DOM component through its ref. */
function EchoCase({ call, code }: { call: (echo: DomRefHandle<EchoHandle>) => unknown; code: string }) {
	const echo = useRef<DomRefHandle<EchoHandle>>(null)
	const { dom, loaded } = useLoaded()
	const [result, setResult] = useState(NOT_RUN)
	const press = useCallback(() => {
		void (async () => {
			await loaded()

			try {
				await call(echo.current!)
				setResult('The call did not reject.')
			} catch (error) {
				setResult(describeError(error))
			}
		})()
	}, [call, loaded])

	return (
		<CaseRow code={code} onPress={press} result={result}>
			<Echo ref={echo} dom={dom} />
		</CaseRow>
	)
}

/** The call is still pending when its component unmounts. */
function BridgeClosedCase() {
	const echo = useRef<DomRefHandle<EchoHandle>>(null)
	const { dom, loaded, restart } = useLoaded()
	const [mount, setMount] = useState(0)
	const [result, setResult] = useState(NOT_RUN)
	const press = useCallback(() => {
		void (async () => {
			await loaded()

			const pending = echo.current!.hang()

			// A new key unmounts the component the call is waiting on, and mounts another one for the next press.
			restart()
			setMount((current) => current + 1)

			try {
				await pending
				setResult('The call did not reject.')
			} catch (error) {
				setResult(describeError(error))
			}
		})()
	}, [loaded, restart])

	return (
		<CaseRow code={DomErrorCode.BridgeClosed} onPress={press} result={result}>
			<Echo key={mount} ref={echo} dom={dom} />
		</CaseRow>
	)
}

/** The DOM side calls an action, and the app makes what it returns impossible to send. */
function NonSerializableResultCase() {
	const reporter = useRef<DomRefHandle<ReporterHandle>>(null)
	const { dom, loaded } = useLoaded()
	const [result, setResult] = useState(NOT_RUN)
	// `NaN` has no JSON form.
	const onProduce = useCallback(() => Promise.resolve(Number.NaN), [])
	const press = useCallback(() => {
		void (async () => {
			await loaded()
			setResult(await reporter.current!.callProduce())
		})()
	}, [loaded])

	return (
		<CaseRow code={DomErrorCode.NonSerializableResult} onPress={press} result={result}>
			<Reporter ref={reporter} onProduce={onProduce} dom={dom} />
		</CaseRow>
	)
}

/** The DOM side calls an action the app stopped passing as a prop. */
function UnknownActionCase() {
	const reporter = useRef<DomRefHandle<ReporterHandle>>(null)
	const { dom, loaded } = useLoaded()
	const [removals, setRemovals] = useState(0)
	const [result, setResult] = useState(NOT_RUN)
	const onProduce = useCallback(() => Promise.resolve(0), [])
	const onGone = useCallback(() => Promise.resolve(), [])
	const press = useCallback(() => {
		void (async () => {
			await loaded()
			setRemovals((current) => current + 1)
		})()
	}, [loaded])

	// Runs after the render without the prop, so the page has been told by the time it is called.
	useEffect(() => {
		if (removals === 0) {
			return
		}

		void reporter.current!.callGone().then(setResult)
	}, [removals])

	return (
		<CaseRow code={DomErrorCode.UnknownAction} onPress={press} result={result}>
			<Reporter ref={reporter} onProduce={onProduce} {...(removals === 0 ? { onGone } : {})} dom={dom} />
		</CaseRow>
	)
}

const HOST_DOM: DomProps = { style: HOST_STYLE }

// The elements of the cases that fail when rendered. Creating them is harmless: the error is thrown
// when React renders them, inside the boundary of their case.
const WITH_DATE_PROP = <Inert value={new Date(0)} dom={HOST_DOM} />
const WITH_NESTED_FUNCTION = <Inert config={{ onPick: noop }} dom={HOST_DOM} />
const WITH_CHILDREN = (
	// @ts-expect-error The props of a DOM component declare no children: this is the mistake the library reports.
	<Inert dom={HOST_DOM}>text</Inert>
)

/** Passes a value the library refuses, which the type of the method allows. */
function callWithDate(echo: DomRefHandle<EchoHandle>) {
	return echo.echo(new Date(0))
}

/** Calls a method the component never exposed, which the type of the ref does not allow. */
function callMissing(echo: DomRefHandle<EchoHandle>) {
	return (echo as unknown as { missing(): Promise<null> }).missing()
}

/** Triggers every runtime error a DOM component can raise, and shows each error's code. */
export default function Errors({ onBack }: { onBack: () => void }) {
	return (
		<ScrollView contentContainerStyle={styles.screen}>
			<Text style={styles.title}>Errors</Text>
			<RenderCase code={DomErrorCode.NonSerializableProp} element={WITH_DATE_PROP} />
			<EchoCase code={DomErrorCode.NonSerializableArgument} call={callWithDate} />
			<NonSerializableResultCase />
			<RenderCase code={DomErrorCode.NestedFunctionProp} element={WITH_NESTED_FUNCTION} />
			<UnknownActionCase />
			<EchoCase code={DomErrorCode.UnknownHandleMethod} call={callMissing} />
			<BridgeClosedCase />
			<RenderCase code={DomErrorCode.ChildrenUnsupported} element={WITH_CHILDREN} />
			<View style={styles.back}>
				<Button testID="back" title="Back" onPress={onBack} />
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	back: { marginTop: 24 },
	result: { paddingVertical: 4 },
	row: { paddingVertical: 8 },
	screen: { padding: 16 },
	title: { fontSize: 20, fontWeight: '600' },
})
