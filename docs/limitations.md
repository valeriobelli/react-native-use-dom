# Limitations

- **New Architecture only**, on React Native 0.81 and later, iOS 15.1 and later, and Android API 24 and later.
- **Expo Go is not supported.** Expo apps need a development build, which includes the library's native view.
- **No React Native inside a DOM component.** A DOM component, and everything it imports, can't import
  `react-native` or a library built on it. The build fails with `ERR_USE_DOM_REACT_NATIVE_IMPORT`. Pass native
  capabilities in as [function props](./actions-out.md).
- **The module exports only its component**, as its default export. Exported types are fine.
- **No children.** Native code can't pass React elements to a DOM component.
- **Only serializable data crosses.** Props, action arguments and results, and ref arguments and results are sent
  as JSON. See [Data in](./data-in.md).
- **Everything across the boundary is asynchronous.** A native action returns a Promise in the DOM component, and a
  ref method returns a Promise in native code.
- **One web view per instance.** Each rendered DOM component is a web view of its own, with its own JavaScript
  context, memory and startup time. Prefer one larger DOM component to many small ones on the same screen.
- **Navigation stays in the page.** Navigating the page to another origin is blocked and reported to
  `dom.onNavigationBlocked`.
- **CSS.** Stylesheets apply globally to the page. `@import` of local stylesheets, CSS Modules, and
  PostCSS, Tailwind or Sass processing are not supported. See [Assets](./assets.md).
- **Assets are files of `public`.** Importing an image or font as a module is not supported.
- **Metro only.** DOM components are built by Metro 0.83.1 or newer, through `withDom`.
