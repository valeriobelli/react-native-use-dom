---
'react-native-use-dom': patch
---

DOM components still render inside `StrictMode` in development and without it in release builds. The page
learns which build it is from the entry Metro generates, and the runtime no longer reads
`process.env.NODE_ENV`.
