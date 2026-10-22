---
'react-native-use-dom': patch
---

DOM components load faster in development. The dev server no longer inlines the source map into the bundle of a DOM page, which made it about four times larger on every load and hot reload: the web view's devtools fetch the map from `/_dom/entry.map` when they open, and still show the component's original source.
