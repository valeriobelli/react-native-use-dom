import { checkLayout, zeroHeightWarning } from './zero-height';

describe('checkLayout', () => {
	it('finds a view that lays out with no height', () => {
		expect(checkLayout('checking', 0, false)).toBe('zero');
	});

	it('stops checking once the view has a height', () => {
		expect(checkLayout('checking', 120, false)).toBe('sized');
		expect(checkLayout('sized', 0, false)).toBe('sized');
	});

	it('decides once, so the minimum height it adds is not taken for a fix', () => {
		expect(checkLayout('zero', 40, false)).toBe('zero');
	});

	it('skips a view sized to its content, which has no height until the page reports one', () => {
		expect(checkLayout('checking', 0, true)).toBe('checking');
	});
});

it('warns with the likely cause and the fixes', () => {
	expect(zeroHeightWarning('Chart')).toMatchSnapshot();
});
