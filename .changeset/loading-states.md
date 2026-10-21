---
'react-native-use-dom': minor
---

DOM components can show something while they load. `dom.fallback` is shown over the view until the component has painted, including while the dev server builds it. The dev server now starts building a component as soon as it is imported. `dom.onLoad` now fires once the component has painted, rather than when the web view finished loading the page.
