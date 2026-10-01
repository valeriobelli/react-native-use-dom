---
'react-native-use-dom': patch
---

Rendering a DOM component in Expo Go now throws `ERR_USE_DOM_EXPO_GO_UNSUPPORTED`, which says to run the app as
a development build, instead of Nitro's error on import. The rest of the app keeps working.
