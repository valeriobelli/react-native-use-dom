/**
 * The native-side API, published as the package root.
 *
 * Application code rarely imports from here: adding `'use dom'` to a file is what produces a
 * component, and these exports are the types that describe it. The DOM-side runtime lives in
 * `react-native-use-dom/dom`.
 */

export { createDomComponentProxy } from './create-dom-component-proxy';
export type { DomComponentProxyOptions } from './create-dom-component-proxy';

export type { DomComponent, DomComponentHandle, DomComponentProps, DomProps } from './types';

export { DomError, DomErrorCode, isDomError } from '../runtime/errors';
export type { DomErrorOptions } from '../runtime/errors';
export type { Serializable } from '../runtime/serializable';
