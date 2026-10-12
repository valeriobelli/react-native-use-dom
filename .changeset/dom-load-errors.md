---
'react-native-use-dom': minor
---

`dom.onError` now receives a `DomLoadError` when a page fails to load, with a stable code
(`ERR_USE_DOM_PAGE_NOT_FOUND` or `ERR_USE_DOM_PAGE_LOAD_FAILED`), the page URL, any HTTP status and a
`kind`. Without a handler, the failure is logged to `console.error`, instead of leaving a blank view.
