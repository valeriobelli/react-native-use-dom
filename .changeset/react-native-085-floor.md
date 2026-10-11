---
'react-native-use-dom': minor
---

The library now needs React Native 0.85 or newer: its `react-native` peer range is `>=0.85.0`, raised from
`>=0.81.0`. 0.85 is the oldest version React Native still supports, and on 0.83 or older the iOS build of
`react-native-nitro-modules` 0.37 fails without `use_frameworks!`
([margelo/nitro#1573](https://github.com/margelo/nitro/issues/1573)). Apps on an older React Native stay on
0.0.1.
