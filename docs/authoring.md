# Authoring

A DOM component is a module whose first statement is the `'use dom'` directive and whose only value export is a
React component, as its default export:

```tsx
'use dom'

import type { DomProps } from 'react-native-use-dom'

export default function Hello({ name }: { name: string; dom?: DomProps }) {
	return <h1>Hello, {name}</h1>
}
```

Native code imports and renders it like any other component:

```tsx
import { View } from 'react-native'

import Hello from './Hello'

export function Screen() {
	return (
		<View style={{ flex: 1 }}>
			<Hello name="world" />
		</View>
	)
}
```

## What runs where

The module's code runs in a web view, never in the native runtime. Inside it, write React DOM: HTML elements,
`className`, `style` objects with CSS properties, browser APIs such as `window`, `fetch` and `localStorage`, and
web libraries from npm. Everything it imports is bundled for the browser.

On native platforms the component's code is not in the app's JavaScript bundle. Importing it gives a native
component with the same props, which renders the module in a web view of its own. Every rendered instance has
its own web view and its own state.

On web the directive does nothing, and the module renders as an ordinary component.

## Rules

- The directive is the first statement in the file, before any import.
- The module default-exports the component. Exporting any other value, such as a constant, a helper or
  `export *`, fails the build. Exported types and interfaces are fine: share values through a separate module
  that both sides import.
- The module, and every module it imports, must not import `react-native` or a module that does. Import the
  library's types with `import type`, which never reaches the bundle.
- Native code doesn't pass `children`: the component's tree lives in the web view.

## Typing the props

Declare the props the native side passes, plus two optional props the library reserves:

- `dom?: DomProps`, which configures the native view (see [Sizing](./sizing.md) and the [`DomProps`
  reference](#the-dom-prop)). The DOM component never receives it.
- `ref?: DomRef<Handle>`, when the component exposes methods (see [Refs](./refs.md)).

```tsx
'use dom'

import type { DomProps, DomRef } from 'react-native-use-dom'

interface ChartProps {
	points: { x: number; y: number }[]
	onSelect(index: number): Promise<void>
	ref?: DomRef<ChartHandle>
	dom?: DomProps
}
```

Declaring `dom` is what lets native code pass it with type checking.

## The `dom` prop

| Option                | Type                     | Default   | Behaviour                                                                                                     |
| --------------------- | ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| `matchContents`       | `boolean`                | `false`   | Sizes the view's height to the rendered content. See [Sizing](./sizing.md).                                   |
| `style`               | `StyleProp<ViewStyle>`   |           | Style of the native view. A size here wins over the content's own size.                                       |
| `backgroundColor`     | `string`                 | `'white'` | Shows before the first paint and where the page is transparent. A `backgroundColor` in `style` wins.          |
| `scrollEnabled`       | `boolean`                | `true`    | Lets the user scroll the content. Turn it off so that drags reach a native `ScrollView` around the component. |
| `onNavigationBlocked` | `(url: string) => void`  |           | Called when the page tries to navigate away, through a link or `window.location`. See below.                  |
| `onLoad`              | `() => void`             |           | Called once the component has mounted and painted for the first time.                                         |
| `onError`             | `(error: Error) => void` |           | Called when the component fails to load or throws an error it doesn't catch.                                  |
| `testID`              | `string`                 |           | The native view's `testID`, for end-to-end tests.                                                             |

```tsx
<Hello name="world" dom={{ matchContents: true, backgroundColor: 'transparent' }} />
```

## Links and navigation

A DOM component never leaves its page. A link to another origin, or an assignment of one to `window.location`, is
blocked, and `onNavigationBlocked` is called with the URL. Open it from there, for example with React Native's
`Linking.openURL(url)`. Anchors inside the page keep working, and an `<iframe>`, such as an embedded video, loads
what it likes.

## Errors

When the component throws during rendering, or fails to load, `onError` is called with the error. Without
`onError`, development builds show the error in React Native's error overlay, and release builds log it.

Errors that the library itself raises are `DomError`s with a stable `code`. [Errors](./errors.md) lists every
code.
