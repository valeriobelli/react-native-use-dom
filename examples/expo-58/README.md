# Expo example, SDK 58

An [Expo](https://docs.expo.dev) app on `expo` 58.0.2, which ships React Native 0.88.0-rc.3, rendering the
shared example app in [`e2e/example-app`](../../e2e/example-app) with `react-native-use-dom`. Its bundle id and
application id are `dev.reactnativeusedom.expo58`.

`pnpm e2e:generate:expo` created this folder. It uses
[Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/): only JavaScript and
`app.json` are committed, and `expo prebuild` generates `ios` and `android`. A patch release of Expo only changes the
versions in `package.json`.

To run it, follow the [Expo example's guide](../expo-57/README.md) from this folder.
