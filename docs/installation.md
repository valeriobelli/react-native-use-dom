# Installation

## Requirements

- React Native 0.81 or newer, with the New Architecture enabled.
- iOS 15.1 or newer, and Android `minSdkVersion` 24 or newer.
- React and React DOM 19.1 or newer, in the same version.
- Metro 0.83.1 or newer, which React Native 0.81 and later already use.

The native build fails with a message naming the requirement when one of these is not met.

## Bare React Native

Install the library, React DOM and [Nitro Modules](https://nitro.margelo.com), which the native view is built
with. Use the React DOM version that matches the app's `react`:

```sh
npm install react-native-use-dom react-native-nitro-modules react-dom
```

Add the Babel plugin to `babel.config.js`:

```js
module.exports = {
	presets: ['module:@react-native/babel-preset'],
	plugins: ['react-native-use-dom/babel'],
}
```

Wrap the config `metro.config.js` exports with `withDom`:

```js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withDom } = require('react-native-use-dom/metro')

module.exports = withDom(mergeConfig(getDefaultConfig(__dirname), {}))
```

`withDom` accepts the config as an object, a Promise of one, or a function Metro calls with its defaults, and
keeps everything the config already does.

Install the pods, then rebuild the app, since the library adds a native view:

```sh
cd ios && bundle exec pod install && cd ..
npx react-native run-ios
npx react-native run-android
```

Restart Metro with `--reset-cache` after changing `babel.config.js`.

## Expo

The app must use a [development build](https://docs.expo.dev/develop/development-builds/introduction/): Expo Go
does not include the library's native view.

```sh
npx expo install react-native-use-dom react-native-nitro-modules react-dom
```

Add the plugin next to `babel-preset-expo` in `babel.config.js`. The library then handles every `'use dom'`
module, in place of Expo's own DOM components:

```js
module.exports = {
	presets: ['babel-preset-expo'],
	plugins: ['react-native-use-dom/babel'],
}
```

Wrap Expo's Metro config with `withDom`:

```js
const { getDefaultConfig } = require('expo/metro-config')
const { withDom } = require('react-native-use-dom/metro')

module.exports = withDom(getDefaultConfig(__dirname))
```

Then rebuild the native app, and start the dev server with the cache cleared:

```sh
npx expo prebuild
npx expo run:ios
npx expo run:android
npx expo start --clear
```

## TypeScript

To import stylesheets from DOM components, add a declaration file to the app, such as `use-dom-env.d.ts`:

```ts
/// <reference types="react-native-use-dom/css" />
```

## Package entry points

| Import                       | Where it runs       | What it holds                                                     |
| ---------------------------- | ------------------- | ----------------------------------------------------------------- |
| `react-native-use-dom`       | native code         | the types of DOM components (`DomProps`, `DomRef`, …), `DomError` |
| `react-native-use-dom/dom`   | `'use dom'` modules | `useDOMImperativeHandle`, `DomError`                              |
| `react-native-use-dom/babel` | `babel.config.js`   | the Babel plugin                                                  |
| `react-native-use-dom/metro` | `metro.config.js`   | `withDom`                                                         |
| `react-native-use-dom/css`   | a `.d.ts` file      | the type of stylesheet imports                                    |

`react-native-use-dom/internal` is used by the code the library generates. Don't import it.
