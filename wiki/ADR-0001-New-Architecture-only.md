## Status

Accepted (2026-10-03)

## Context

React Native has two architectures, the legacy one and the New Architecture. Supporting both would double the native surface a web view component has to be tested on, while the New Architecture is the one React Native keeps developing. The library's native view has to be a first-class view in the app's tree, with a typed contract between native code and JavaScript.

## Decision

The library supports only React Native's New Architecture, on React Native 0.81 and later. Its native view is a Nitro hybrid view.

## Consequences

- Users get one native implementation per platform, with a typed contract between native code and JavaScript.
- Apps that still run the legacy architecture cannot use the library, and the native build fails with a message naming the requirement.
- Apps need `react-native-nitro-modules` as a dependency, next to the library.
