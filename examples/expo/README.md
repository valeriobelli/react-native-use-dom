# Expo example

An [Expo](https://docs.expo.dev) app that renders the same DOM components as the [bare example](../bare), with
`react-native-use-dom` in place of Expo's own `'use dom'` support. It shows:

- a DOM component that receives props, calls native actions, and exposes a ref handle;
- a component sized to its content with `matchContents`, whose external link the app opens itself, styled by a
  stylesheet it imports, with an icon from [`public`](./public).

The components are in [`src`](./src), and [`App.tsx`](./App.tsx) renders them. [`use-dom-env.d.ts`](./use-dom-env.d.ts)
references `react-native-use-dom/css`, which lets TypeScript accept the stylesheet import. A page loads the files of
`public` by URLs relative to it, from the dev server in development and from the app in a release build. The app runs as a
[development build](https://docs.expo.dev/develop/development-builds/introduction/): Expo Go does not include the
library's native view.

## How it is set up

- [`babel.config.js`](./babel.config.js) adds `react-native-use-dom/babel` next to `babel-preset-expo`. The
  library handles every `'use dom'` module, so Expo's own handling never sees one.
- [`metro.config.js`](./metro.config.js) wraps Expo's `getDefaultConfig` with `withDom`. Expo CLI's dev server
  then serves the DOM components alongside the app.

Inside this repository, the config also resolves `react`, `react-dom`, `react-native` and
`react-native-nitro-modules` from the app, because the workspace holds other copies of them for the bare example
and the library. An app outside a monorepo doesn't need that.

## Requirements

- The [Expo environment for development builds](https://docs.expo.dev/get-started/set-up-your-environment/) for
  the platforms you run on: Xcode and CocoaPods' Ruby for iOS, Android Studio with an emulator for Android.
- Node.js 22.12 or newer.
- pnpm, in the version the repository's `packageManager` field names (`corepack enable` picks it up).

## Run it

From the repository root, install the workspace and build the library, which the example uses from the workspace:

```sh
pnpm install
pnpm build
```

Then, in `examples/expo`, generate the native projects:

```sh
cd examples/expo
pnpm exec expo prebuild --no-install
```

Start the dev server and leave it running:

```sh
pnpm start
```

In a second terminal in `examples/expo`, build and launch the app.

### iOS

The first time, and after native dependencies change, install the pods:

```sh
bundle install
bundle exec pod install --project-directory=ios
```

Then:

```sh
pnpm ios --no-bundler
```

### Android

```sh
pnpm android --no-bundler
```

## Edit it

Edit a DOM component in `src` and save: it updates in place, and keeps its state where Fast Refresh can. Edits to
the rest of the app update the app as usual, and leave the DOM components as they are.

After changing the library itself, run `pnpm build` again at the repository root and reload the app.
