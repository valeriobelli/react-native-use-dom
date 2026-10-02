# Errors

Every error `react-native-use-dom` throws is a `DomError` with a stable `code`, which is safe to branch on. Messages may be reworded between versions; codes are not.

<!-- Generated from packages/react-native-use-dom/src/docs/errors.ts by `pnpm docs:errors`. Edit that file instead. -->

## `ERR_USE_DOM_BRIDGE_CLOSED`

**What happens.** A call across the boundary rejects because the component went away, or a hook from `react-native-use-dom/dom` throws.

**Why.** A call can't complete once the DOM component unmounts or its WebView closes. The hooks only work while the native side renders the component in its WebView.

**Fix.** Expect calls to reject when a screen is dismissed, and ignore this code there. Use the hooks only in `'use dom'` modules, and open DOM components through their native proxy, not in a browser.

## `ERR_USE_DOM_CHILDREN_UNSUPPORTED`

**What happens.** Rendering a DOM component with children throws.

**Why.** The DOM component's tree lives in the WebView, and React elements created in native code can't be sent to it.

**Fix.** Pass the content as a serializable prop, such as a string or a list of items, or move the markup inside the DOM component.

## `ERR_USE_DOM_EXPO_GO_UNSUPPORTED`

**What happens.** Rendering a DOM component in Expo Go throws.

**Why.** A DOM component renders in the library's native view, and Expo Go includes only the native code Expo ships with it.

**Fix.** Run the app as a [development build](https://docs.expo.dev/develop/development-builds/create-a-build/), built with `npx expo run:ios` or `npx expo run:android`, or with EAS Build.

## `ERR_USE_DOM_INVALID_MODULE_EXPORTS`

**What happens.** The build fails on a module marked `'use dom'`.

**Why.** On a native platform a `'use dom'` module is replaced by a component that renders it in a WebView, and only its default export can be replaced that way. Other values it exports would never reach native code, so the module must export only the component, as its default export.

**Fix.** Default-export the React component to render. Move any other value into a separate module that both sides import. Exported types are fine.

## `ERR_USE_DOM_MALFORMED_MESSAGE`

**What happens.** The native side or a DOM component reports a message it can't understand, or a page that started without its props.

**Why.** The two sides exchange messages in a format of their own, over `window.ReactNativeWebView`. Something other than this library posted to it, or the page is not one the library built.

**Fix.** Make sure no other code in the page posts to `window.ReactNativeWebView`. If nothing does, report the error with the app's and the library's versions.

## `ERR_USE_DOM_MISSING_BUNDLE_OUTPUT`

**What happens.** `react-native bundle` fails for an app that renders DOM components.

**Why.** A release bundle with DOM components writes their pages next to the app's other resources. The command was given no `--assets-dest`, so there is nowhere to write them.

**Fix.** Pass `--assets-dest` with the folder the app's resources are copied from. Xcode's “Bundle React Native code and images” build phase and React Native's Gradle plugin already pass it.

## `ERR_USE_DOM_MISSING_METRO_CONFIG`

**What happens.** A DOM component fails to load in a release build because the app has no page for it. In development, Metro reports that the DOM component transformer ran without its settings.

**Why.** DOM component pages are built and embedded by the Metro integration. Without `withDom()` in `metro.config.js` nothing builds them, and Metro can't build a DOM bundle with the library's transformer configured by hand.

**Fix.** Wrap the config `metro.config.js` exports with `withDom` from `react-native-use-dom/metro`, then rebuild the app. Don't point Metro's `babelTransformerPath` at the library's transformer directly.

## `ERR_USE_DOM_NESTED_FUNCTION_PROP`

**What happens.** Rendering a DOM component throws, naming the path to a function inside an object or array prop.

**Why.** Only a top-level function prop becomes a native action that the DOM component can call. A function nested in another value has no way to be called from the WebView.

**Fix.** Pass the function as a prop of its own.

## `ERR_USE_DOM_NON_SERIALIZABLE_ARGUMENT`

**What happens.** A call across the boundary rejects before it is sent, because one of its arguments could not be sent.

**Why.** The arguments of a native action and of a ref method are sent as JSON. A value JSON would lose or change is refused instead of arriving wrong.

**Fix.** Pass only strings, finite numbers, booleans, `null`, arrays and plain objects.

## `ERR_USE_DOM_NON_SERIALIZABLE_PROP`

**What happens.** Rendering a DOM component throws, naming the prop and the path to the value it rejected.

**Why.** Props are sent to the WebView as JSON. A value JSON would lose or change, such as a `Date`, a `Map`, a class instance, `NaN` or a circular object, is refused instead of arriving wrong.

**Fix.** Convert the value to strings, finite numbers, booleans, `null`, arrays and plain objects before passing it, for example a `Date` to its ISO string.

## `ERR_USE_DOM_NON_SERIALIZABLE_RESULT`

**What happens.** A call across the boundary rejects, because the value it returned could not be sent back.

**Why.** What a native action or a ref method returns is sent back to the caller as JSON. A value JSON would lose or change is refused instead of arriving wrong.

**Fix.** Return only strings, finite numbers, booleans, `null`, arrays and plain objects, or nothing.

## `ERR_USE_DOM_REACT_NATIVE_IMPORT`

**What happens.** The build of a DOM component fails, naming the module that imports `react-native` or one of its libraries.

**Why.** A DOM component runs in a browser engine, where React Native does not exist.

**Fix.** Use DOM elements and web libraries inside the DOM component. For a native capability, pass a function prop from the native side and call it from the DOM component.

## `ERR_USE_DOM_UNKNOWN_ACTION`

**What happens.** A native action called from a DOM component rejects, naming the action.

**Why.** The native actions are the function props the component is currently rendered with. That prop is missing, or was removed by a later render.

**Fix.** Check the name, and that the native side still passes the function prop.

## `ERR_USE_DOM_UNKNOWN_COMPONENT`

**What happens.** The dev server refuses to build a DOM component page.

**Why.** The dev server builds a page only for a component the native view names, and only from a file Metro serves: one in the project or its `watchFolders`. That keeps the dev server from bundling arbitrary files on request.

**Fix.** Render the component through its native proxy, not by opening the page URL. If the component lives outside the project, add its folder to `watchFolders` in `metro.config.js`.

## `ERR_USE_DOM_UNKNOWN_HANDLE_METHOD`

**What happens.** A call through a DOM component's `ref` rejects, naming the method.

**Why.** A `ref` reaches only the methods the component exposes through `useDOMImperativeHandle`, as they were in its latest render.

**Fix.** Add the method to the object `useDOMImperativeHandle` returns, and check the name.
