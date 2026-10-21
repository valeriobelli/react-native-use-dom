## Status

Accepted (2026-10-21)

## Context

A DOM component paints some time after native code renders it. Its web view starts and loads the page, and in development the dev server also builds the component, starting its web bundler for the first one. Until the first paint the view showed only its background colour, and `dom.onLoad` fired when the web view finished loading the page. In development that is the loader page, before it has fetched the component, so `onLoad` came before the component existed.

## Decision

- The page reports `mounted` after the frame of its first commit, and `dom.onLoad` fires on it rather than when the web view finishes loading.
- `dom.fallback` is a native element shown over the view until `mounted`, and again from a reloaded page's `ready` until its next `mounted`, since the native view reports no load start. It covers the whole wait, the dev server's build included, and works in development and release.
- Every component asks the dev server for its bundle as soon as native code imports it, from the dev server the app's bundle came from, so the build often finishes before a screen renders it.

## Consequences

- The native side builds the dev bundle URL, so it and the page's loader share `devEntryBundlePath` in the runtime.
- A release build embeds its pages, so `fallback` only covers the web view's own start there.
- Importing a DOM component in development makes a request to the dev server, even for a component that never renders.
