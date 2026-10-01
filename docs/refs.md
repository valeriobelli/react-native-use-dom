# Refs

A DOM component can expose methods that native code calls through a `ref`, with `useDOMImperativeHandle` from
`react-native-use-dom/dom`. It works like React's `useImperativeHandle`, except that every call crosses into the
web view and is asynchronous.

## In the DOM component

Declare the handle as an interface, and the `ref` prop as `DomRef` of it:

```tsx
'use dom'

import { useState } from 'react'
import type { DomProps, DomRef } from 'react-native-use-dom'
import { useDOMImperativeHandle } from 'react-native-use-dom/dom'

export interface EditorHandle {
	getText(): string
	clear(): void
}

interface EditorProps {
	ref?: DomRef<EditorHandle>
	dom?: DomProps
}

export default function Editor(_: EditorProps) {
	const [text, setText] = useState('')

	useDOMImperativeHandle<EditorHandle>(
		() => ({
			getText: () => text,
			clear: () => setText(''),
		}),
		[text],
	)

	return <textarea value={text} onChange={(event) => setText(event.target.value)} />
}
```

The methods are replaced whenever the dependencies change, so a method always sees the render it was created in.
List what it reads, as with `useImperativeHandle`.

## In native code

Hold the ref as `DomRefHandle` of the same interface. Every method returns a Promise:

```tsx
import { useRef } from 'react'
import { Button } from 'react-native'
import type { DomRefHandle } from 'react-native-use-dom'

import type { EditorHandle } from './Editor'
import Editor from './Editor'

export function Screen() {
	const editor = useRef<DomRefHandle<EditorHandle>>(null)

	const save = async () => {
		const text = await editor.current?.getText()
		await editor.current?.clear()
		console.log(text)
	}

	return (
		<>
			<Editor ref={editor} />
			<Button title="Save" onPress={save} />
		</>
	)
}
```

## The contract

- A method may return a value, a Promise, or nothing. The native call resolves with the value, or with `null` for
  nothing.
- Arguments and results must be [serializable](./data-in.md#what-a-prop-may-contain).
- When a method throws or rejects, the native call rejects with an `Error` carrying the same `message`, `name` and
  serializable own properties.
- Calling a method the latest handle doesn't have rejects with `ERR_USE_DOM_UNKNOWN_HANDLE_METHOD`.
- Call the methods once the component has loaded, which `dom.onLoad` reports, or in response to something the
  user did.
- When the component unmounts, pending calls reject with `ERR_USE_DOM_BRIDGE_CLOSED`. Expect that when a screen is dismissed.
- Every rendered instance has its own handle.
- `useDOMImperativeHandle` only works in a `'use dom'` module rendered by the library. Elsewhere it throws
  `ERR_USE_DOM_BRIDGE_CLOSED`.
