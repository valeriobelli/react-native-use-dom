# Decisions

This wiki holds the product and architecture decisions of `react-native-use-dom`: one page per
decision, each with the context that led to it and its consequences. It says what was decided and
why, never how the library implements it.

Pages are edited through pull requests to the [`wiki` folder](https://github.com/valeriobelli/react-native-use-dom/tree/main/wiki)
of the repository, which is the wiki's source of truth: the repository's wiki publishing mirrors it on every
push to `main` that changes it, so edits made in the wiki's editor are overwritten. See
[CONTRIBUTING.md](https://github.com/valeriobelli/react-native-use-dom/blob/main/CONTRIBUTING.md) for
when to add a decision page and when to update the docs instead.

## Decisions

- [ADR 0001: New Architecture only](ADR-0001-New-Architecture-only.md): the library supports only the New Architecture, with a Nitro hybrid view.
- [ADR 0002: No Expo dependency](ADR-0002-No-Expo-dependency.md): bare React Native and Expo development builds, no Expo package, no Expo Go.
- [ADR 0003: DOM code never imports React Native](ADR-0003-DOM-code-never-imports-React-Native.md): a DOM component runs in a browser engine, so importing `react-native` fails the build.
- [ADR 0004: JSON only across the bridge](ADR-0004-JSON-only-across-the-bridge.md): values JSON would change are refused, and functions are allowed only as top-level props.
- [ADR 0005: Navigation stays in the page](ADR-0005-Navigation-stays-in-the-page.md): navigating to another origin is blocked and reported, and the app decides where links go.
- [ADR 0006: Release builds embed pages](ADR-0006-Release-builds-embed-pages.md): release builds work without a dev server or a network.
- [ADR 0007: Errors carry stable codes](ADR-0007-Errors-carry-stable-codes.md): every error the library throws has a documented, stable code.
- [ADR 0008: Supported React Native versions](ADR-0008-Supported-React-Native-versions.md): End of Cycle through Future, peer range `>=0.81`, one example app per version.
