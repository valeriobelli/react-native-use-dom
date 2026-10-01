# Troubleshooting

Errors the library raises carry a stable code, starting `ERR_USE_DOM_`. Look it up in [Errors](./errors.md).

## The component doesn't show

- **Zero height.** Without `matchContents`, the view fills its parent, and a parent with no size of its own gives
  it none. Give the parent a size, set `dom.matchContents`, or set a size in `dom.style`. See
  [Sizing](./sizing.md).
- **White box.** The page failed to load or threw. Pass `dom.onError` to see the error, and check the dev server's
  terminal, where the page's logs and build errors print.
- **The module renders as native code, or `'use dom'` has no effect.** The Babel plugin isn't running. Check that
  `react-native-use-dom/babel` is in `babel.config.js`, that the directive is the first statement in the file,
  and restart the dev server with its cache cleared (`react-native start --reset-cache`, `expo start --clear`).

## It works in development but not in release

- `withDom` must wrap the config `metro.config.js` exports: without it, release builds embed no pages
  (`ERR_USE_DOM_MISSING_METRO_CONFIG`).
- A file the page loads must be in `public`, and its URL relative, without a leading `/`.
- A page that loads remote content needs the network, unlike the page itself.

## Build errors

- **`ERR_USE_DOM_REACT_NATIVE_IMPORT`.** Something the DOM component imports reaches React Native. The message
  names the module. Use `import type` for types from `react-native-use-dom`, and keep native-only modules out of
  the DOM component's imports.
- **`ERR_USE_DOM_INVALID_MODULE_EXPORTS`.** The `'use dom'` module exports something besides its default
  component. Move the value to a module of its own.
- **iOS: `The New Architecture is required`, or a minimum React Native version.** The library needs the New
  Architecture and React Native 0.81 or later. Run `pod install` again after fixing it.
- **Android: `minSdkVersion 24 or higher is required`.** Raise `minSdkVersion` in the app's Gradle config.
- **An error that the native view or a Nitro module can't be found.** The app was not rebuilt after the library
  was installed, or runs in Expo Go. Rebuild the native app.

## Runtime errors

- **`ERR_USE_DOM_NON_SERIALIZABLE_PROP` or `ERR_USE_DOM_NESTED_FUNCTION_PROP`.** A prop can't be sent. The message
  names the path to the value. See [Data in](./data-in.md).
- **`ERR_USE_DOM_BRIDGE_CLOSED` from a ref or an action.** The component unmounted while the call was pending,
  which is expected when a screen closes. From a hook, it means the hook ran outside a DOM component the library
  rendered.
- **`ERR_USE_DOM_UNKNOWN_HANDLE_METHOD`.** The method isn't in the object `useDOMImperativeHandle` returned in the
  latest render.

## The dev server

- **`ERR_USE_DOM_UNKNOWN_COMPONENT`.** The dev server builds pages only for files it serves. A DOM component
  outside the project, as in a monorepo, needs its folder in `watchFolders`.
- **The device can't load the page.** It loads from the dev server like the app's bundle. Check that the device
  reaches Metro, and on Android over USB run `adb reverse tcp:8081 tcp:8081`.
