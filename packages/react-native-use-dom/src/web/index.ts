/**
 * The runtime a `'use dom'` module runs against, published as `react-native-use-dom/dom`.
 *
 * Everything here runs in the WebView, never in the native runtime. The native-side API lives in
 * the package root.
 */

export { useDOMImperativeHandle } from './use-dom-imperative-handle'
export type { DomHandle, DomHandleMethod } from './use-dom-imperative-handle'

export { mountDomComponent } from './mount'
export type { DomComponent, MountOptions } from './mount'

export { DomError, DomErrorCode, isDomError } from '../runtime/errors'
export type { Serializable } from '../runtime/serializable'
