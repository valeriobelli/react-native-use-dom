---
'react-native-use-dom': minor
---

Release builds load each DOM component's page from the `dom.bundle/` folder next to the running JS
bundle, instead of always from the app binary. An over-the-air update that replaces the bundle and
ships the pages written next to it (as `react-native bundle --assets-dest` and `expo export:embed` do)
now updates the DOM components too. The pages keep their origins, so `localStorage` survives updates
and rollbacks. A page missing next to the running bundle fails with `ERR_USE_DOM_PAGE_NOT_FOUND`, and is
never loaded from the app binary instead.
