# react-native-use-dom

Render React DOM components inside React Native with the `'use dom'` directive. No Expo required.

```tsx
// Hello.tsx
'use dom'

import type { DomProps } from 'react-native-use-dom'

export default function Hello({ name }: { name: string; dom?: DomProps }) {
	return <h1>Hello, {name}, from the DOM</h1>
}
```

```tsx
// App.tsx
import Hello from './Hello'

export default function App() {
	return <Hello name="React Native" dom={{ matchContents: true }} />
}
```

On iOS and Android the component renders in a native web view. Its props are sent across, its function props
become native actions it can await, and methods it exposes are reachable through a `ref`. Release builds ship
every page with the JS bundle, so components load offline and update with it over the air. On web, the module is
an ordinary React component.

<p align="center">
	<img src="https://raw.githubusercontent.com/valeriobelli/react-native-use-dom/main/docs/assets/native-bridge.gif" width="260" alt="Calling a DOM component: native actions, a ref reset, and a prop update" />
	&nbsp;&nbsp;&nbsp;
	<img src="https://raw.githubusercontent.com/valeriobelli/react-native-use-dom/main/docs/assets/fast-refresh.gif" width="260" alt="Fast Refresh updates a DOM component in place and keeps its state" />
</p>

- Works in bare React Native apps and in Expo development builds.
- New Architecture, React Native 0.85 or newer, iOS 15.1+, Android API 24+.
- Fast Refresh for DOM components, stylesheets, and a `public` folder for images and fonts.
- Over-the-air updates that ship the pages with the JS bundle, tested with [hot-updater](https://hot-updater.dev).
  expo-updates is not supported. See
  [Over-the-air updates](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/builds.md#over-the-air-updates).

## Install

```sh
npm install react-native-use-dom react-native-nitro-modules react-dom
```

```js
// babel.config.js
module.exports = {
	presets: ['module:@react-native/babel-preset'],
	plugins: ['react-native-use-dom/babel'],
}
```

```js
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withDom } = require('react-native-use-dom/metro')

module.exports = withDom(mergeConfig(getDefaultConfig(__dirname), {}))
```

Then install the pods and rebuild the app. For Expo, see
[Installation](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/installation.md#expo).

## Talk to native code

A top-level function prop is a native action. The DOM component awaits it, and it runs in the native runtime:

```tsx
// ShareButton.tsx
'use dom'

import type { DomProps } from 'react-native-use-dom'

export default function ShareButton({ onShare }: { onShare(): Promise<boolean>; dom?: DomProps }) {
	return <button onClick={() => void onShare()}>Share</button>
}
```

Native code calls methods the component exposes with `useDOMImperativeHandle`, through a `ref`. Every call is
asynchronous. See
[Actions out](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/actions-out.md) and
[Refs](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/refs.md).

## Rules

- `'use dom'` is the first statement of the file, and the module default-exports its component. Exported types
  are fine.
- A DOM component never imports `react-native` or a library built on it. Pass native capabilities in as function
  props.
- Props, action arguments and results are JSON. Native code never passes `children`.
- Each rendered DOM component is a web view of its own: prefer one larger component to many small ones.

The full list is in [Limitations](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/limitations.md).

## Sizing

By default the view fills its parent, as a view with `flex: 1` does, so the parent needs a size. Inside a
`ScrollView`, size it to its content instead:

```tsx
<Article html={html} dom={{ matchContents: true, scrollEnabled: false }} />
```

See [Sizing](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/sizing.md).

## The `dom` prop

| Option                | Default   | What it does                                                         |
| --------------------- | --------- | -------------------------------------------------------------------- |
| `matchContents`       | `false`   | Sizes the view's height to the rendered content.                     |
| `style`               |           | Style of the native view. A size here wins over the content's size.  |
| `backgroundColor`     | `'white'` | Shows before the first paint and where the page is transparent.      |
| `scrollEnabled`       | `true`    | Turn it off so that drags reach a native `ScrollView` around it.     |
| `onNavigationBlocked` |           | Called with the URL when the page tries to navigate to another site. |
| `fallback`            |           | Shown over the view until the component has painted.                 |
| `onLoad`              |           | Called once the component has mounted and painted.                   |
| `onError`             |           | Called when the component fails to load or throws.                   |
| `testID`              |           | The native view's `testID`, for end-to-end tests.                    |

## Troubleshooting

- **The component doesn't show.** It probably has zero height: in development it is outlined in red. Give the
  parent a size, or set `dom.matchContents`.
- **`'use dom'` has no effect.** Check `react-native-use-dom/babel` is in `babel.config.js`, then restart the dev
  server with its cache cleared.
- **It works in development but not in release.** `withDom` must wrap the config `metro.config.js` exports.

Every error has an `ERR_USE_DOM_*` code, explained in
[Errors](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/errors.md). More in
[Troubleshooting](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/troubleshooting.md).

## Documentation

- [Guide](https://github.com/valeriobelli/react-native-use-dom/tree/main/docs): authoring, data in, actions out,
  refs, sizing, assets, builds, limitations, troubleshooting.
- [Errors](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/errors.md): every error code.
- [`AGENTS.md`](./AGENTS.md): the rules in one page, for coding agents.

## License

MIT
