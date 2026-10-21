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

/** The fallback over a view that fills its parent: the view's size is known, so the fallback takes it. */
const COVER = { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 } as const

/** Clips a content-sized web view while it sits under a fallback shorter than itself. */
const CLIP = { overflow: 'hidden' } as const

export function useViewStyles({
	componentName,
	contentHeight,
	covered,
	dom,
}: {
	componentName: string
	contentHeight: number | null
	/** Whether `dom.fallback` is shown over the web view. */
	covered: boolean
	dom: DomProps
}): {
	fallbackStyle: StyleProp<ViewStyle>
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
			dom.matchContents && covered ? CLIP : null,
			debugStyle,
		],
		[dom.backgroundColor, dom.matchContents, dom.style, covered, debugStyle],
	)
	// Sized inside the view's own style, so that its borders and padding add to the content's size.
	// Under a fallback, a content-sized web view is taken out of the flow instead, so that the view is
	// as tall as the fallback rather than as content it has not painted yet, while the web view keeps
	// the size the content will have.
	const webViewStyle = useMemo<ViewStyle>(() => {
		if (!dom.matchContents) {
			return FILL_PARENT
		}

		const height = contentHeight ?? 0

		return covered ? { height, left: 0, position: 'absolute', right: 0, top: 0 } : { height }
	}, [dom.matchContents, contentHeight, covered])
	// With `matchContents` the fallback stays in the flow, so the view takes its height.
	const fallbackStyle = dom.matchContents ? null : COVER

	return { fallbackStyle, onLayout, style, webViewStyle }
}
