---
'react-native-use-dom': patch
---

Release builds find the DOM components of the native bundle from the code Metro already holds, instead of reading every module's source from disk again. On the example apps this removes 0.6 to 1.2 seconds from every `react-native bundle`, warm builds included.
