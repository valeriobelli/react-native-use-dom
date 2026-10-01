# Using react-native-use-dom

Instructions for adding a DOM component to a React Native app with `react-native-use-dom`. The package's type
definitions document every export; this file says how to put them together.

## What it is

A module whose first statement is `'use dom'` is a DOM component. Its code runs in a web view, as React DOM, and
never in the native runtime. Native code imports its default export and renders it like any React Native
component.

## Check the setup first

Before writing a component, confirm the app is set up. If any of these is missing, add it, then rebuild the native
app and restart the dev server with its cache cleared.

1. `react-native-use-dom`, `react-native-nitro-modules` and `react-dom` (same version as `react`) are
   dependencies. The app uses the New Architecture, React Native 0.81 or newer.
2. `babel.config.js` lists `'react-native-use-dom/babel'` in `plugins`.
3. `metro.config.js` wraps what it exports with `withDom` from `'react-native-use-dom/metro'`, as in
   `module.exports = withDom(config)`.
4. To import `.css` files, a `.d.ts` file in the app contains `/// <reference types="react-native-use-dom/css" />`.
5. Expo apps run as a development build, not in Expo Go.

## Write the component

```tsx
// src/Counter.tsx
'use dom'

import { useState } from 'react'
import type { DomProps, DomRef } from 'react-native-use-dom'
import { useDOMImperativeHandle } from 'react-native-use-dom/dom'

import './Counter.css'

export interface CounterHandle {
	reset(): void
	getCount(): number
}

interface CounterProps {
	label: string
	onChange(count: number): Promise<void>
	ref?: DomRef<CounterHandle>
	dom?: DomProps
}

export default function Counter({ label, onChange }: CounterProps) {
	const [count, setCount] = useState(0)

	useDOMImperativeHandle<CounterHandle>(
		() => ({
			reset: () => setCount(0),
			getCount: () => count,
		}),
		[count],
	)

	const increment = async () => {
		const next = count + 1
		setCount(next)
		await onChange(next)
	}

	return (
		<button className="counter" type="button" onClick={increment}>
			{label}: {count}
		</button>
	)
}
```

## Render it from native code

```tsx
import { useRef } from 'react'
import { Button, View } from 'react-native'
import type { DomRefHandle } from 'react-native-use-dom'

import type { CounterHandle } from './src/Counter'
import Counter from './src/Counter'

export function Screen() {
	const counter = useRef<DomRefHandle<CounterHandle>>(null)

	return (
		<View style={{ flex: 1 }}>
			<Counter
				ref={counter}
				label="Taps"
				onChange={async (count) => console.log(count)}
				dom={{ matchContents: true }}
			/>
			<Button title="Reset" onPress={() => void counter.current?.reset()} />
		</View>
	)
}
```

## Rules

Breaking these fails the build or throws at runtime with an `ERR_USE_DOM_*` code.

- `'use dom'` is the first statement of the file, before the imports.
- The module default-exports the component and exports no other value. `export interface` and `export type` are
  allowed. Put shared constants and helpers in a separate module.
- Inside the DOM component, use HTML elements (`div`, `button`, `img`), `className`, CSS `style` objects, browser
  APIs and web libraries. Never import `react-native`, a React Native library, or a module that imports one.
  Import types from `react-native-use-dom` with `import type` only.
- The only runtime import from the library inside a DOM component is `react-native-use-dom/dom`. Native code
  imports types from `react-native-use-dom`.
- Native code never passes `children`.
- Props are JSON: strings, finite numbers, booleans, `null`, arrays and plain objects. Convert a `Date` to an ISO
  string, a `Map` to an object or array, a class instance to a plain object.
- Functions are allowed only as top-level props. In the DOM component, calling one returns a Promise of the native
  function's result (`null` when it returns nothing). Type them as returning a `Promise`. Their arguments and
  results are JSON too.
- Methods for native code go through `useDOMImperativeHandle<Handle>(() => methods, deps)`. Export the `Handle`
  interface, declare `ref?: DomRef<Handle>` in the props, and hold the ref natively as
  `useRef<DomRefHandle<Handle>>(null)`. Every call from native code returns a Promise.
- Declare `dom?: DomProps` in the props, so native code can pass view options.

## Sizing

- By default the view fills its parent (`flex: 1`). The parent must have a size, or the component has zero height
  and doesn't show.
- `dom={{ matchContents: true }}` sizes the height to the content. Use it inside a `ScrollView` or wherever the
  parent has no size, with `scrollEnabled: false` inside a `ScrollView`.
- `dom={{ style: { height: 200 } }}` sets a fixed size.

## View options (`dom` prop)

`matchContents`, `style`, `backgroundColor` (default `'white'`; `'transparent'` to see through),
`scrollEnabled` (default `true`), `onNavigationBlocked(url)` (links to another origin are blocked; open them with
`Linking.openURL`), `onLoad()`, `onError(error)`, `testID`.

## Assets

- `import './File.css'` applies a stylesheet to the page. Stylesheets from npm packages work too. No CSS Modules,
  no `@import` of local files, no Tailwind or PostCSS.
- Images, fonts and other files go in `public/` next to `metro.config.js`, and load by a relative URL without a
  leading slash: `public/logo.png` is `<img src="logo.png" />`, and `url(logo.png)` in CSS. Don't import them as
  modules.

## Checking the result

- Run the app's type check. The types catch wrong or missing props, a ref for another handle, a synchronous
  use of a ref method, and unknown `dom` options. A value that isn't JSON is caught when it is rendered, with
  `ERR_USE_DOM_NON_SERIALIZABLE_PROP`.
- In the running app, errors from the page print in the dev server's terminal. Pass `dom.onError` to handle them.
- Every `ERR_USE_DOM_*` code is explained in
  [docs/errors.md](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/errors.md), and the full
  guide is in [docs](https://github.com/valeriobelli/react-native-use-dom/tree/main/docs).
