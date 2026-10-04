## Status

Accepted (2026-10-03)

## Context

New React Native versions come out regularly, and the library depends on native code that changes with them. Users need to know which versions they can rely on, and contributors need a rule that follows React Native's own schedule without a decision for each release. React Native publishes the support status of its versions on its [releases overview](https://reactnative.dev/releases/overview).

## Decision

The supported versions are those React Native lists as End of Cycle through Future. A Future version counts once a release candidate is published. The peer range stays `react-native >=0.81`, and 0.81 is still checked. Expo SDKs follow the same window, and one example app is provided per supported version.

## Consequences

- The set of supported versions follows React Native's schedule without a new decision for each release.
- Versions older than React Native's End of Cycle are no longer checked, although the peer range still lets them install.
- Users on a supported version can use its example app as a starting point, and as a reproducer when reporting an issue.
- Each new version adds an example app to maintain.
