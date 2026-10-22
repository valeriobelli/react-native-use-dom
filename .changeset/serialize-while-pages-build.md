---
'react-native-use-dom': patch
---

Release builds serialize the native bundle while the DOM component pages build, instead of after them. A page that fails to build still fails the `bundle` command, and the bundle is written only once its pages are. Serialization is short next to the page builds, so on the example apps this saves milliseconds, not seconds.
