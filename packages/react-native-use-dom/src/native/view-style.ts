import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'

import type { DomProps } from './types'
import { useZeroHeightCheck } from './zero-height'

export const FILL_PARENT = { flex: 1 } as const

const FLEX_KEYS = ['flex', 'flexBasis', 'flexGrow'] as const

/**
 * A size in `dom.style` must win, as docs/sizing.md says. `flex: 1` means `flexBasis: 0`, which
 * overrides a `height` in a column, so a view with a `height` grows from its height instead and stops
 * at it: in a column the height wins, and in a row the view still fills the width.
 */
export function fillParentStyle(style: StyleProp<ViewStyle>): ViewStyle | null {
	const flat = StyleSheet.flatten(style)

	// Compared with undefined, not by truthiness: 0 is a size, and `height: 0` must not fill the parent.
	if (FLEX_KEYS.some((key) => flat?.[key] !== undefined)) {
		return null
	}

	return flat?.height === undefined ? FILL_PARENT : { flexGrow: 1, maxHeight: flat.height }
}

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
