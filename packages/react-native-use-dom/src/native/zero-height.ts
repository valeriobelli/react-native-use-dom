import { useCallback, useState } from 'react'
import type { LayoutChangeEvent, ViewStyle } from 'react-native'

/** Where the zero height check stands for one view: it decides on the first layout that tells. */
export type ZeroHeightCheck = 'checking' | 'zero' | 'sized'

/** Outlines the view and gives it some height, so that it can be found on screen. */
export const ZERO_HEIGHT_DEBUG_STYLE: ViewStyle = { minHeight: 40, borderWidth: 1, borderColor: 'red' }

/**
 * The check after a layout `height` tall. A view sized to its content is skipped: it is 0 tall until
 * the page reports its size, and that is expected.
 */
export function checkLayout(current: ZeroHeightCheck, height: number, matchContents: boolean): ZeroHeightCheck {
	if (current !== 'checking' || matchContents) return current
	return height === 0 ? 'zero' : 'sized'
}

/** What the check warns when `componentName` lays out with no height. */
export function zeroHeightWarning(componentName: string): string {
	return [
		`The DOM component ${componentName} has a height of 0, so it doesn't show. In development, it is outlined in red and given a minimum height, so that it can be found.`,
		'By default a DOM component fills its parent, which needs a size of its own. Give the parent one, size the component with `dom={{ style: { height: 200 } }}`, or size it to its content with `dom={{ matchContents: true }}`.',
	].join('\n\n')
}

/**
 * In development, warns once and outlines the view when a DOM component lays out with no height,
 * which is what a component that fills a parent without a size gets.
 */
export function useZeroHeightCheck(
	componentName: string,
	matchContents: boolean,
): { debugStyle: ViewStyle | null; onLayout: (event: LayoutChangeEvent) => void } {
	const [check, setCheck] = useState<ZeroHeightCheck>('checking')

	const onLayout = useCallback(
		(event: LayoutChangeEvent) => {
			const next = checkLayout(check, event.nativeEvent.layout.height, matchContents)
			if (next === check) return
			// oxlint-disable-next-line no-console
			if (next === 'zero') console.warn(zeroHeightWarning(componentName))
			setCheck(next)
		},
		[check, componentName, matchContents],
	)

	return { debugStyle: check === 'zero' ? ZERO_HEIGHT_DEBUG_STYLE : null, onLayout }
}
