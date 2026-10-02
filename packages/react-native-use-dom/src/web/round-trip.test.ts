import { NativeDomBridge } from '../native/host-bridge'
import { POST_MESSAGE_GLOBAL } from '../runtime/protocol'
import type { DomBridge } from './bridge'
import { createDomBridge } from './bridge'

/**
 * Wires the two halves of the bridge directly to each other, standing in for the WebView: whatever
 * the page posts is handed to the native side, and whatever the native side dispatches arrives as
 * the `CustomEvent` the page listens for.
 *
 * Each half is unit-tested against a fake counterpart elsewhere. This is where they have to agree.
 */
function connect(instanceId: string): { dom: DomBridge; native: NativeDomBridge } {
	const native = new NativeDomBridge(instanceId, (eventName, payload) => {
		globalThis.dispatchEvent(new CustomEvent(eventName, { detail: payload }))
	})

	;(globalThis as Record<string, unknown>)[POST_MESSAGE_GLOBAL] = {
		injectedObjectJson: () => JSON.stringify({ actions: [], instanceId, props: {} }),
		postMessage: (raw: string) => {
			native.receive(raw)
		},
	}

	const dom = createDomBridge({ actions: ['onSave'], instanceId, props: {} })

	return { dom, native }
}

let dom: DomBridge
let native: NativeDomBridge

beforeEach(() => {
	;({ dom, native } = connect('i1'))
})

afterEach(() => {
	dom.dispose()
	native.dispose()
})

describe('the two halves of the bridge, connected', () => {
	it('re-sends props when the page reports ready, closing the startup race', () => {
		const { native: fresh } = connect('i2')
		const onReady = jest.fn(() => {
			fresh.sendProps({ title: 'Hello' }, [])
		})

		fresh.setCallbacks({ onReady })

		const late = createDomBridge({ actions: [], instanceId: 'i2', props: {} })

		expect(onReady).toHaveBeenCalledTimes(1)
		expect(late.getProps()).toEqual({ title: 'Hello' })
		late.dispose()
		fresh.dispose()
	})

	it('delivers a prop change to the page', () => {
		native.sendProps({ title: 'Updated' }, ['onSave'])
		expect(dom.getProps()).toEqual({ title: 'Updated' })
		expect(dom.getActionNames()).toEqual(['onSave'])
	})

	it('runs a native action for the page and returns its value', async () => {
		native.setActions({ onSave: async (draft: string) => ({ id: draft.length }) })
		await expect(dom.callAction('onSave', ['draft'])).resolves.toEqual({ id: 5 })
	})

	it('rejects the page with the native error', async () => {
		native.setActions({
			onSave: () => {
				throw Object.assign(new RangeError('disk full'), { free: 0 })
			},
		})

		await expect(dom.callAction('onSave', [])).rejects.toMatchObject({
			free: 0,
			message: 'disk full',
			name: 'RangeError',
		})
	})

	it('runs a DOM method for the native side and returns its value', async () => {
		dom.setHandle({ getText: () => 'typed' })
		await expect(native.callHandle('getText', [])).resolves.toBe('typed')
	})

	it('rejects the native side with the DOM-side error', async () => {
		dom.setHandle({
			explode: () => {
				throw new TypeError('nope')
			},
		})

		await expect(native.callHandle('explode', [])).rejects.toMatchObject({
			message: 'nope',
			name: 'TypeError',
		})
	})

	it('keeps two instances on one page from seeing each other', async () => {
		const second = connect('i2')
		const seen: string[] = []

		native.setActions({ onSave: () => seen.push('first') })
		second.native.setActions({ onSave: () => seen.push('second') })

		await second.dom.callAction('onSave', [])

		expect(seen).toEqual(['second'])
		second.dom.dispose()
		second.native.dispose()
	})
})
