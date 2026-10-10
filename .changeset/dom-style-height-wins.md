---
'react-native-use-dom': patch
---

A `height`, `flex`, `flexBasis` or `flexGrow` in `dom.style` now sizes the view, as the docs say. Before,
the view kept filling its parent, so in a parent without a height of its own it was 0 high even with
`dom={{ style: { height: 120 } }}`.
