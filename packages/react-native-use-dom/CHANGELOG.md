# react-native-use-dom

## 0.3.0

### Minor Changes

- [`58ac4be`](https://github.com/valeriobelli/react-native-use-dom/commit/58ac4be85b2192c5a4cdadd0c2c9fb29060ff716) Thanks [@valeriobelli](https://github.com/valeriobelli)! - DOM components can show something while they load. `dom.fallback` is shown over the view until the component has painted, including while the dev server builds it. The dev server now starts building a component as soon as it is imported. `dom.onLoad` now fires once the component has painted, rather than when the web view finished loading the page.

### Patch Changes

- [#122](https://github.com/valeriobelli/react-native-use-dom/pull/122) [`8a2f923`](https://github.com/valeriobelli/react-native-use-dom/commit/8a2f9230b94268524663ef2ba845b8135dda3c03) Thanks [@valeriobelli](https://github.com/valeriobelli)! - DOM components load faster in development. The dev server no longer inlines the source map into the bundle of a DOM page, which made it about four times larger on every load and hot reload: the web view's devtools fetch the map from `/_dom/entry.map` when they open, and still show the component's original source.

- [`58ac4be`](https://github.com/valeriobelli/react-native-use-dom/commit/58ac4be85b2192c5a4cdadd0c2c9fb29060ff716) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Release builds with several DOM components bundle faster. The pages share the modules they import, and those are now transformed and minified once per build instead of once per component: on the example apps with 11 components, a cold `react-native bundle` takes about half the time.

- [#118](https://github.com/valeriobelli/react-native-use-dom/pull/118) [`d746afb`](https://github.com/valeriobelli/react-native-use-dom/commit/d746afbb71420ec9bc64300f31e6a88d0a248175) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Release builds find the DOM components of the native bundle from the code Metro already holds, instead of reading every module's source from disk again. On the example apps this removes 0.6 to 1.2 seconds from every `react-native bundle`, warm builds included.

- [#121](https://github.com/valeriobelli/react-native-use-dom/pull/121) [`5dac982`](https://github.com/valeriobelli/react-native-use-dom/commit/5dac9826728ce36268cfde95708a68bd46682a54) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Release builds serialize the native bundle while the DOM component pages build, instead of after them. A page that fails to build still fails the `bundle` command, and the bundle is written only once its pages are. Serialization is short next to the page builds, so on the example apps this saves milliseconds, not seconds.

## 0.2.0

### Minor Changes

- [#105](https://github.com/valeriobelli/react-native-use-dom/pull/105) [`2a4ecd0`](https://github.com/valeriobelli/react-native-use-dom/commit/2a4ecd0d772eaf052006aa6b134880d00dbbfb2d) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Add `dom.hideKeyboardAccessoryView`, which hides the bar iOS shows above the keyboard while an input in a DOM
  component has focus, and empties the iPad shortcut bar, like react-native-webview's prop of the same name. It
  is iOS only: Android ignores it.

### Patch Changes

- [#102](https://github.com/valeriobelli/react-native-use-dom/pull/102) [`80f58ed`](https://github.com/valeriobelli/react-native-use-dom/commit/80f58ed44a44cc1f08744d825f0ccdf7cda17f42) Thanks [@valeriobelli](https://github.com/valeriobelli)! - The package depends on `react-refresh` `^0.19.0` instead of exactly `0.14.2`. The repository also checks
  for unused files, exports and dependencies with knip, in CI and before a commit.

- [#108](https://github.com/valeriobelli/react-native-use-dom/pull/108) [`dcdcfc3`](https://github.com/valeriobelli/react-native-use-dom/commit/dcdcfc3a0f20ae378e6459402d61a15a91a60e18) Thanks [@valeriobelli](https://github.com/valeriobelli)! - The npm keywords include `dom-components`, `expo`, `expo-dom-components`, `nitro-modules` and `react-dom`, so
  the package shows up when people search npm and React Native Directory for those terms.

## 0.1.0

### Minor Changes

- [#86](https://github.com/valeriobelli/react-native-use-dom/pull/86) [`aa7db01`](https://github.com/valeriobelli/react-native-use-dom/commit/aa7db016903034760c68a5bf8909637ce3c7c15c) Thanks [@valeriobelli](https://github.com/valeriobelli)! - `dom.onError` now receives a `DomLoadError` when a page fails to load, with a stable code
  (`ERR_USE_DOM_PAGE_NOT_FOUND` or `ERR_USE_DOM_PAGE_LOAD_FAILED`), the page URL, any HTTP status and a
  `kind`. Without a handler, the failure is logged to `console.error`, instead of leaving a blank view.

- [#99](https://github.com/valeriobelli/react-native-use-dom/pull/99) [`0c870ec`](https://github.com/valeriobelli/react-native-use-dom/commit/0c870ec857dae96374ae7fb813f2e978dfdca3e6) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Release builds load each DOM component's page from the `dom.bundle/` folder next to the running JS
  bundle, instead of always from the app binary. An over-the-air update that replaces the bundle and
  ships the pages written next to it (as `react-native bundle --assets-dest` and `expo export:embed` do)
  now updates the DOM components too. The pages keep their origins, so `localStorage` survives updates
  and rollbacks. A page missing next to the running bundle fails with `ERR_USE_DOM_PAGE_NOT_FOUND`, and is
  never loaded from the app binary instead.

- [#84](https://github.com/valeriobelli/react-native-use-dom/pull/84) [`af7cab5`](https://github.com/valeriobelli/react-native-use-dom/commit/af7cab54e0bfab41110f8436ffb9c7ccb53b4616) Thanks [@valeriobelli](https://github.com/valeriobelli)! - The library now needs React Native 0.85 or newer: its `react-native` peer range is `>=0.85.0`, raised from
  `>=0.81.0`. 0.85 is the oldest version React Native still supports, and on 0.83 or older the iOS build of
  `react-native-nitro-modules` 0.37 fails without `use_frameworks!`
  ([margelo/nitro#1573](https://github.com/margelo/nitro/issues/1573)). Apps on an older React Native stay on
  0.0.1.

### Patch Changes

- [#79](https://github.com/valeriobelli/react-native-use-dom/pull/79) [`730b5f0`](https://github.com/valeriobelli/react-native-use-dom/commit/730b5f001c27246b19723deb58c02b40aa9a5a56) Thanks [@valeriobelli](https://github.com/valeriobelli)! - A `height`, `flex`, `flexBasis` or `flexGrow` in `dom.style` now sizes the view, as the docs say. Before,
  the view kept filling its parent, so in a parent without a height of its own it was 0 high even with
  `dom={{ style: { height: 120 } }}`.

- [#98](https://github.com/valeriobelli/react-native-use-dom/pull/98) [`62f9859`](https://github.com/valeriobelli/react-native-use-dom/commit/62f9859112bd40c4f24e2903e66e1c504a5fc96c) Thanks [@valeriobelli](https://github.com/valeriobelli)! - The README covers native actions and refs, the rules a DOM component follows, sizing, the `dom` prop and
  troubleshooting, with links to the guide.

- [#95](https://github.com/valeriobelli/react-native-use-dom/pull/95) [`10968e7`](https://github.com/valeriobelli/react-native-use-dom/commit/10968e73de79a191ca37a02309f01133c829d942) Thanks [@valeriobelli](https://github.com/valeriobelli)! - The package carries its own `LICENSE` file, so the MIT license ships with every release, whatever the
  package's `files` list says.

- [#37](https://github.com/valeriobelli/react-native-use-dom/pull/37) [`7e8a0e8`](https://github.com/valeriobelli/react-native-use-dom/commit/7e8a0e8320ce3f5346c242ce4db70c80debaa5ec) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Fix release builds of Expo apps in a monorepo failing with "outside the project and its watch folders" for a DOM component in a workspace package. DOM components under Metro's server root are now allowed.

- [#97](https://github.com/valeriobelli/react-native-use-dom/pull/97) [`3e0475f`](https://github.com/valeriobelli/react-native-use-dom/commit/3e0475f4bbb6b37a0d9e1fa0723d184204dbd109) Thanks [@valeriobelli](https://github.com/valeriobelli)! - The published package is about half its previous size: it no longer ships source maps or the TypeScript
  sources, which nothing loads at runtime.

- [#96](https://github.com/valeriobelli/react-native-use-dom/pull/96) [`f9c71a6`](https://github.com/valeriobelli/react-native-use-dom/commit/f9c71a6f8cd7e0d593f0f104339330b255d49f0f) Thanks [@valeriobelli](https://github.com/valeriobelli)! - DOM components still render inside `StrictMode` in development and without it in release builds. The page
  learns which build it is from the entry Metro generates, and the runtime no longer reads
  `process.env.NODE_ENV`.

## 0.0.1

### Patch Changes

- [`d47a096`](https://github.com/valeriobelli/react-native-use-dom/commit/d47a09691ee2b9e75c1d2d1f0b29a41599d5e769) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Rendering a DOM component in Expo Go now throws `ERR_USE_DOM_EXPO_GO_UNSUPPORTED`, which says to run the app as
  a development build, instead of Nitro's error on import. The rest of the app keeps working.

- [`b9c6ebc`](https://github.com/valeriobelli/react-native-use-dom/commit/b9c6ebcb8f46ba297f9c5e66e4c6bd59762103ce) Thanks [@valeriobelli](https://github.com/valeriobelli)! - Fix native actions, ref calls and prop updates that stopped reaching a DOM component after a Fast Refresh, and in
  Strict Mode from the first render.

- [`18f7b51`](https://github.com/valeriobelli/react-native-use-dom/commit/18f7b517cb2526ccdea7bd917860f8aa684a1228) Thanks [@valeriobelli](https://github.com/valeriobelli)! - In development, a DOM component that lays out with a height of 0 now logs a warning with the likely cause and the
  fixes, and is outlined in red with a minimum height, so that it can be found.
