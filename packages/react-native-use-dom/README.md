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
become native actions it can await, and methods it exposes are reachable through a `ref`. Release builds embed
every page, so components load offline. On web, the module is an ordinary React component.

<p align="center">
	<img src="https://raw.githubusercontent.com/valeriobelli/react-native-use-dom/main/docs/assets/native-bridge.gif" width="260" alt="Calling a DOM component: native actions, a ref reset, and a prop update" />
	&nbsp;&nbsp;&nbsp;
	<img src="https://raw.githubusercontent.com/valeriobelli/react-native-use-dom/main/docs/assets/fast-refresh.gif" width="260" alt="Fast Refresh updates a DOM component in place and keeps its state" />
</p>

- Works in bare React Native apps and in Expo development builds.
- New Architecture, React Native 0.81 or newer, iOS 15.1+, Android API 24+.
- Fast Refresh for DOM components, stylesheets, and a `public` folder for images and fonts.

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

## Documentation

- [Guide](https://github.com/valeriobelli/react-native-use-dom/tree/main/docs): authoring, data in, actions out,
  refs, sizing, assets, builds, limitations, troubleshooting.
- [Errors](https://github.com/valeriobelli/react-native-use-dom/blob/main/docs/errors.md): every error code.
- [`AGENTS.md`](./AGENTS.md): the rules in one page, for coding agents.

## License

MIT
