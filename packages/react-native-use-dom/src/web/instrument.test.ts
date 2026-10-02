import type { DomBridge } from './bridge'
import { reportContentSize } from './instrument'

describe('reportContentSize', () => {
	it("reports the document's size, which counts the body's margins as content", () => {
		const reportSize = jest.fn()
		const root = document.createElement('div')

		root.getBoundingClientRect = () => ({ height: 58, width: 374 }) as DOMRect
		jest.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue({ height: 74, width: 390 } as DOMRect)

		reportContentSize({ reportSize } as unknown as DomBridge, root)

		expect(reportSize).toHaveBeenCalledWith(390, 74)
	})
})
