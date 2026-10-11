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
 * at it: in a column the height wins, and in a row the view still fills the width. The cap goes after
 * `dom.style`, so that a larger `maxHeight` there can't lift it; percentages can't be compared, so then
 * the caller's `maxHeight` is the cap.
 */
export function fillParentStyle({ style }: { style: StyleProp<ViewStyle> }): ViewStyle | null {
	const flat = StyleSheet.flatten(style)

	// Compared with undefined, not by truthiness: 0 is a size, and `height: 0` must not fill the parent.
	if (FLEX_KEYS.some((key) => flat?.[key] !== undefined)) {
		return null
	}

	if (flat?.height === undefined) {
		return FILL_PARENT
	}

	const { height, maxHeight } = flat
	const cap =
		typeof height === 'number' && typeof maxHeight === 'number' ? Math.min(height, maxHeight) : (maxHeight ?? height)

	return { flexGrow: 1, maxHeight: cap }
}

export function useViewStyles({
	componentName,
	contentHeight,
	dom,
}: {
	componentName: string
	contentHeight: number | null
	dom: DomProps
}): {
	onLayout: (event: LayoutChangeEvent) => void
	style: StyleProp<ViewStyle>
	webViewStyle: ViewStyle
} {
	const { debugStyle, onLayout } = useZeroHeightCheck(componentName, dom.matchContents ?? false)
	const style = useMemo(
		() => [
			{ backgroundColor: dom.backgroundColor ?? 'white' },
			dom.style,
			dom.matchContents ? null : fillParentStyle({ style: dom.style }),
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
