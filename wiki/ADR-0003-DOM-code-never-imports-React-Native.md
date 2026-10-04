## Status

Accepted (2026-10-03)

## Context

A DOM component runs in a browser engine inside a web view, not in the React Native runtime. React Native and the libraries built on it expect native modules that do not exist there, so code that imports them breaks at run time, often in ways that are hard to trace. Everything a DOM component imports ends up in its page.

## Decision

A DOM component, and everything it imports, must never import `react-native` or a library built on it. Importing it fails the build.

## Consequences

- The mistake is caught when the app is built, with a documented error code, instead of on a user's device.
- A DOM component can use HTML, CSS, browser APIs and web libraries, and it stays portable to the web.
- Native capabilities, such as the camera or haptics, reach a DOM component only as function props that native code provides.
- Shared code that mixes native and web concerns has to be split so that the DOM side stays free of React Native.
