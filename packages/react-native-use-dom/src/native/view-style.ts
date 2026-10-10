import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'

import type { DomProps } from './types'
import { useZeroHeightCheck } from './zero-height'

/** What makes a view fill its parent when nothing else sizes it. */
export const FILL_PARENT = { flex: 1 } as const

/**
 * The keys that size a view along its parent's default (column) axis. `flex: 1` means `flexBasis: 0`,
 * which a `height` doesn't override, so with any of them the view must not also fill its parent.
 */
const MAIN_AXIS_SIZE_KEYS = ['height', 'flex', 'flexBasis', 'flexGrow'] as const

/**
 * The fill-parent style of a view whose `dom.style` is `style`: none when that style sizes the view
 * along the main axis itself, so that a size in `dom.style` wins, as docs/sizing.md says.
 */
export function fillParentStyle(style: StyleProp<ViewStyle>): typeof FILL_PARENT | null {
	const flat = StyleSheet.flatten(style)

	return MAIN_AXIS_SIZE_KEYS.some((key) => flat?.[key] !== undefined) ? null : FILL_PARENT
}

/**
 * The styles of the view and of the WebView inside it, and the layout listener that, in development,
 * outlines a view with no height.
 */
export function useViewStyles(
	componentName: string,
	dom: DomProps,
	contentHeight: number | null,
): {
	onLayout: (event: LayoutChangeEvent) => void
	style: StyleProp<ViewStyle>
	webViewStyle: ViewStyle
} {
	const { debugStyle, onLayout } = useZeroHeightCheck(componentName, dom.matchContents ?? false)
	const style = useMemo(
		() => [
			{ backgroundColor: dom.backgroundColor ?? 'white' },
			dom.matchContents ? null : fillParentStyle(dom.style),
			dom.style,
			debugStyle,
		],
		[dom.backgroundColor, dom.matchContents, dom.style, debugStyle],
	)
	// Sized inside the view's own style, so that its borders and padding add to the content's size.
	const webViewStyle = useMemo(
		() => (dom.matchContents ? { height: contentHeight ?? 0 } : FILL_PARENT),
		[dom.matchContents, contentHeight],
	)

	return { onLayout, style, webViewStyle }
}
