## Status

Accepted (2026-10-11). Supersedes the peer range of [ADR 0008](ADR-0008-Supported-React-Native-versions.md).

## Context

[ADR 0008](ADR-0008-Supported-React-Native-versions.md) kept the peer range at `react-native >=0.81` and kept checking 0.81 after React Native stopped supporting it. Since Nitro 0.37, which the library needs, an app on React Native 0.83 or older cannot build on iOS without `use_frameworks!` ([margelo/nitro#1573](https://github.com/margelo/nitro/issues/1573)), so 0.81 could no longer be checked. React Native 0.85 is the oldest version React Native still supports, End of Cycle on its [releases overview](https://reactnative.dev/releases/overview).

## Decision

The peer range is `react-native >=0.85`. While React Native supports the oldest version of the range, the checks that run on every change cover it. Once React Native stops supporting it, it is still checked every night until a new decision raises the range.

## Consequences

- Apps on React Native 0.84 or older cannot install a release with this range, and stay on an earlier release.
- Until React Native stops supporting 0.85, every version the peer range allows is checked on every change.
- Raising the range is a breaking change, released as such.
