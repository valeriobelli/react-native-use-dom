'use dom'

import type { DomProps } from 'react-native-use-dom'

/**
 * A page the `page-not-found` flow deletes from a release build, so that the app renders a DOM
 * component whose page is not next to the running bundle and reports `ERR_USE_DOM_PAGE_NOT_FOUND`.
 *
 * The text is the marker the flow looks for to find this component's page; it is rendered rather
 * than exported, because a DOM component module may export only its default, and rendering keeps it
 * in the bundle after minification.
 */
// oxlint-disable-next-line no-unused-vars -- the prop only gives the component its type
export default function Missing(_: { dom?: DomProps }) {
	return <span>use-dom-e2e-missing-page</span>
}
