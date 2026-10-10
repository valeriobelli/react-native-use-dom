import { FILL_PARENT, fillParentStyle } from './view-style'

// React Native's own flatten merges arrays from left to right and drops falsy entries.
jest.mock('react-native', () => ({
	StyleSheet: {
		flatten: (style: unknown): unknown =>
			Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : style,
	},
}))

describe('fillParentStyle', () => {
	it('fills the parent when dom.style gives no size', () => {
		expect(fillParentStyle(undefined)).toBe(FILL_PARENT)
		expect(fillParentStyle({ borderRadius: 8, width: 200 })).toBe(FILL_PARENT)
	})

	it('lets a height in dom.style win, which a flex basis of 0 would override', () => {
		expect(fillParentStyle({ height: 120 })).toBeNull()
		expect(fillParentStyle([{ margin: 4 }, [{ height: '50%' }]])).toBeNull()
	})

	it('leaves the flex of the view to dom.style when it sets one', () => {
		expect(fillParentStyle({ flex: 2 })).toBeNull()
		expect(fillParentStyle({ flexBasis: 80 })).toBeNull()
		expect(fillParentStyle({ flexGrow: 1 })).toBeNull()
	})
})
