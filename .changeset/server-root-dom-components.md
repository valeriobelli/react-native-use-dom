---
'react-native-use-dom': patch
---

Fix release builds of Expo apps in a monorepo failing with "outside the project and its watch folders" for a DOM component in a workspace package. DOM components under Metro's server root are now allowed.
