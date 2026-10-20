---
'react-native-use-dom': patch
---

Release builds with several DOM components bundle faster. The pages share the modules they import, and those are now transformed and minified once per build instead of once per component: on the example apps with 11 components, a cold `react-native bundle` takes about half the time.
