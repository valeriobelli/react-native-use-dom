# Development and release builds

## Development

The app's dev server, `react-native start` or `expo start`, also builds and serves DOM components, on the same
port. Nothing else needs to run. The first DOM component rendered after the dev server starts takes longer to
show, while its bundle builds.

A DOM component loads from the dev server like the app's JavaScript does, so a device that reaches Metro reaches
the DOM components too. On an Android device over USB, that means `adb reverse tcp:8081 tcp:8081`, as for the
app.

- **Fast Refresh.** Saving a DOM component, or a module or stylesheet it imports, updates every rendered instance
  in place, keeping its state where Fast Refresh can. An edit Fast Refresh can't apply reloads the page. Editing
  native code refreshes the app and leaves the DOM components as they are.
- **Restarts.** When the dev server restarts, open pages reconnect to it on their own.
- **Logs.** `console.log` and the other `console` methods in a DOM component print to the app's log, in the dev
  server's terminal, alongside the app's own.
- **Errors.** An error a DOM component doesn't catch shows in React Native's error overlay, unless `dom.onError`
  handles it.
- **Inspecting the page.** In development builds, the web view can be inspected: with Safari's Develop menu on
  iOS 16.4 and later, and with `chrome://inspect` in Chrome for Android.

## Release

A release build writes the page of every DOM component the app renders, with the stylesheets it imports and the
files of `public`, into a `dom.bundle` folder next to the JS bundle. Each page loads from that folder beside the
running bundle: they need no dev server and no network connection. When the app runs the bundle built into it, the
pages load from the app itself.

This happens as part of the release bundle, with `withDom` in `metro.config.js` and no other step:

- iOS: Xcode's "Bundle React Native code and images" build phase, in a Release build.
- Android: React Native's Gradle plugin, in a release build.
- Expo: the same steps, run by `expo run:ios --configuration Release`, `expo run:android --variant release`, or EAS
  Build.
- By hand: `react-native bundle` with `--assets-dest`, which says where the pages go. Without it the command fails
  with `ERR_USE_DOM_MISSING_BUNDLE_OUTPUT`.

A DOM component's `console` calls still reach the app's log, as the app's own do. The web view can't be
inspected in a release build.

## Over-the-air updates

Pages load from the same place as the running JS bundle. An over-the-air update that replaces the JS bundle
updates the DOM components with it, as long as it ships the `dom.bundle` folder that
`react-native bundle --assets-dest` or `expo export:embed` writes next to the bundle.

- **Storage is kept.** `localStorage` and the page's other storage stay across updates and rollbacks.
- **No fallback.** A page missing from an update fails with `ERR_USE_DOM_PAGE_NOT_FOUND`, which `dom.onError`
  receives. The page built into the app is never loaded in its place.
- **Tested with** [hot-updater](https://hot-updater.dev), in bare React Native and Expo apps.

expo-updates is not supported: see [Limitations](./limitations.md).
