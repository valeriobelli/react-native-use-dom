# Bare React Native example

A [React Native Community CLI](https://github.com/react-native-community/cli) app, without Expo, that renders
DOM components with `react-native-use-dom`. It shows:

- a DOM component that receives props, calls native actions, and exposes a ref handle;
- a component sized to its content with `matchContents`, whose external link the app opens itself.

The components are in [`src`](./src), and [`App.tsx`](./App.tsx) renders them.

## Requirements

- The [React Native environment](https://reactnative.dev/docs/set-up-your-environment) for the platforms you run
  on: Xcode and CocoaPods' Ruby for iOS, Android Studio with an emulator for Android.
- Node.js 22.12 or newer.
- pnpm, in the version the repository's `packageManager` field names (`corepack enable` picks it up).

## Run it

From the repository root, install the workspace and build the library, which the example uses from the workspace:

```sh
pnpm install
pnpm build
```

Then, in `examples/bare`, start Metro and leave it running:

```sh
cd examples/bare
pnpm start
```

In a second terminal in `examples/bare`, build and launch the app.

### iOS

The first time, and after native dependencies change, install the pods:

```sh
bundle install
bundle exec pod install --project-directory=ios
```

Then:

```sh
pnpm ios
```

React Native 0.87 apps don't launch on iOS 27, which requires the UIScene life cycle that React Native adopts in
0.88. Run the example on an iOS 26 or earlier simulator, and pick one with `pnpm ios --udid <id>` when several are
booted (`xcrun simctl list devices booted` lists them).

### Android

```sh
pnpm android
```

## Build for release

```sh
pnpm android --mode release
pnpm ios --mode Release
```

A release build embeds the page of every DOM component the app renders, so the components show with Metro
stopped and without a network connection.

## Edit it

Edit a DOM component in `src` and save: it updates in place, and keeps its state where Fast Refresh can. Edits to
the rest of the app update the app as usual, and leave the DOM components as they are.

After changing the library itself, run `pnpm build` again at the repository root and reload the app.
