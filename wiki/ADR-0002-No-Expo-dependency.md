## Status

Accepted (2026-10-03)

## Context

Expo offers its own DOM components, but a library that requires an Expo package would shut out bare React Native apps. Expo apps and bare apps share the same native view and the same JavaScript contract, so nothing in the library needs an Expo package.

## Decision

The library works in bare React Native and in Expo development builds, and needs no Expo package. It does not support Expo Go, which cannot include the library's native view.

## Consequences

- Bare React Native apps and Expo apps use the same library, the same setup steps and the same documentation.
- In an Expo app the library's Babel plugin takes over every `'use dom'` module, in place of Expo's own DOM components.
- Expo apps must use a development build: running in Expo Go fails with a documented error.
