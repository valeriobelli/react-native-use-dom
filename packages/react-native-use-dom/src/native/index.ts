/**
 * The native-side API, published as the package root.
 *
 * Application code rarely imports from here: adding `'use dom'` to a file is what produces a
 * component, and these exports are the types that describe it. The DOM-side runtime lives in
 * `react-native-use-dom/dom`.
 */

export { createDomComponentProxy, type DomComponentProxyOptions } from './create-dom-component-proxy'

export type {
	DomComponent,
	DomComponentHandle,
	DomComponentProps,
	DomHandleCall,
	DomProps,
	DomRef,
	DomRefHandle,
} from './types'

export { DomError, DomErrorCode, isDomError, type DomErrorOptions } from '../runtime/errors'
export type { Serializable } from '../runtime/serializable'
