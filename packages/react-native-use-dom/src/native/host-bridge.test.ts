import { DomErrorCode } from '../runtime/errors'
import type { DomToNativeMessage, NativeToDomMessage } from '../runtime/protocol'
import { encodeMessage, nativeEventName } from '../runtime/protocol'
import { serializeError } from '../runtime/wire-error'
import { NativeDomBridge } from './host-bridge'
import type { HostBridgeCallbacks } from './host-bridge'

let dispatched: { eventName: string; message: NativeToDomMessage }[]
let bridge: NativeDomBridge

/** Speaks to the bridge the way the WebView does: one JSON string at a time. */
function fromDom(message: DomToNativeMessage): void {
	bridge.receive(encodeMessage(message))
}

function lastOfType<T extends NativeToDomMessage['type']>(
	type: T,
): Extract<NativeToDomMessage, { type: T }> | undefined {
	const matches = dispatched.filter((entry) => entry.message.type === type)
	return matches.at(-1)?.message as Extract<NativeToDomMessage, { type: T }> | undefined
}

function flush(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0)
	})
}

function capture(run: () => unknown): unknown {
	try {
		run()
	} catch (error) {
		return error
	}
	throw new Error('expected the call to throw')
}

beforeEach(() => {
	dispatched = []
	bridge = new NativeDomBridge('i1', (eventName, payload) => {
		dispatched.push({ eventName, message: JSON.parse(payload) as NativeToDomMessage })
	})
})

describe('NativeDomBridge', () => {
	it('addresses every message to its own instance, so siblings never see it', () => {
		bridge.sendProps({ title: 'Hello' }, [])
		expect(dispatched[0]?.eventName).toBe(nativeEventName('i1'))
		expect(dispatched[0]?.message).toMatchObject({ instanceId: 'i1', props: { title: 'Hello' } })
	})

	it('ignores a message from another instance sharing the page', () => {
		const onReady = jest.fn()
		bridge.setCallbacks({ onReady })
		bridge.receive(encodeMessage({ type: 'ready', instanceId: 'other', protocolVersion: 1 }))
		expect(onReady).not.toHaveBeenCalled()
	})

	describe('running a native action for the DOM side', () => {
		it('calls the function prop and returns its result', async () => {
			const onSave = jest.fn(async (draft: string) => `saved:${draft}`)
			bridge.setActions({ onSave: onSave as never })

			fromDom({ type: 'action-call', instanceId: 'i1', callId: 'c1', action: 'onSave', args: ['draft'] })
			await flush()

			expect(onSave).toHaveBeenCalledWith('draft')
			expect(lastOfType('result')).toMatchObject({ callId: 'c1', ok: true, value: 'saved:draft' })
		})

		it('reports a rejection back, preserving the error', async () => {
			bridge.setActions({
				onSave: (() => Promise.reject(Object.assign(new RangeError('disk full'), { free: 0 }))) as never,
			})

			fromDom({ type: 'action-call', instanceId: 'i1', callId: 'c1', action: 'onSave', args: [] })
			await flush()

			expect(lastOfType('result')).toMatchObject({
				ok: false,
				error: { name: 'RangeError', message: 'disk full', properties: { free: 0 } },
			})
		})

		it('resolves a function that returns nothing as null', async () => {
			bridge.setActions({ onPress: (() => undefined) as never })

			fromDom({ type: 'action-call', instanceId: 'i1', callId: 'c1', action: 'onPress', args: [] })
			await flush()

			expect(lastOfType('result')).toMatchObject({ ok: true, value: null })
		})

		it('rejects a result the DOM side could not receive intact', async () => {
			bridge.setActions({ load: (() => new Map()) as never })

			fromDom({ type: 'action-call', instanceId: 'i1', callId: 'c1', action: 'load', args: [] })
			await flush()

			expect(lastOfType('result')).toMatchObject({
				ok: false,
				error: { message: expect.stringContaining('the value returned by `load`') },
			})
		})

		it('reports a prop that is no longer being passed instead of hanging', async () => {
			bridge.setActions({})

			fromDom({ type: 'action-call', instanceId: 'i1', callId: 'c1', action: 'onSave', args: [] })
			await flush()

			expect(lastOfType('result')).toMatchObject({
				ok: false,
				error: { message: expect.stringContaining('`onSave` is not a native action') },
			})
		})
	})

	describe('calling into the DOM component', () => {
		it('resolves with what the DOM method returned', async () => {
			const pending = bridge.callHandle('getText', [])
			const call = lastOfType('handle-call')
			expect(call).toMatchObject({ method: 'getText', args: [] })

			fromDom({ type: 'result', instanceId: 'i1', callId: call!.callId, ok: true, value: 'typed' })
			await expect(pending).resolves.toBe('typed')
		})

		it('rejects with the DOM-side error', async () => {
			const pending = bridge.callHandle('explode', [])
			const call = lastOfType('handle-call')

			fromDom({
				type: 'result',
				instanceId: 'i1',
				callId: call!.callId,
				ok: false,
				error: serializeError(new TypeError('nope')),
			})

			await expect(pending).rejects.toMatchObject({ name: 'TypeError', message: 'nope' })
		})

		it('refuses a non-serializable argument before it leaves the app', () => {
			expect(capture(() => bridge.callHandle('setDate', [new Date(0)]))).toMatchObject({
				code: DomErrorCode.NonSerializableArgument,
				message: expect.stringContaining('argument 1 of `setDate`'),
			})
			expect(lastOfType('handle-call')).toBeUndefined()
		})

		it('keeps concurrent calls apart when results come back out of order', async () => {
			const first = bridge.callHandle('get', ['a'])
			const second = bridge.callHandle('get', ['b'])
			const calls = dispatched.filter((entry) => entry.message.type === 'handle-call')

			fromDom({
				type: 'result',
				instanceId: 'i1',
				callId: (calls[1]!.message as never as { callId: string }).callId,
				ok: true,
				value: 'B',
			})
			fromDom({
				type: 'result',
				instanceId: 'i1',
				callId: (calls[0]!.message as never as { callId: string }).callId,
				ok: true,
				value: 'A',
			})

			await expect(Promise.all([first, second])).resolves.toEqual(['A', 'B'])
		})

		it('rejects in-flight calls when the component unmounts', async () => {
			const pending = bridge.callHandle('getText', [])
			bridge.dispose()
			await expect(pending).rejects.toMatchObject({ code: DomErrorCode.BridgeClosed })
		})
	})

	describe('reports from the page', () => {
		const callbacks: HostBridgeCallbacks = {}

		it('re-sends props once the DOM runtime says it is ready', () => {
			const onReady = jest.fn()
			bridge.setCallbacks({ ...callbacks, onReady })
			fromDom({ type: 'ready', instanceId: 'i1', protocolVersion: 1 })
			expect(onReady).toHaveBeenCalledTimes(1)
		})

		it('forwards a measured size', () => {
			const onResize = jest.fn()
			bridge.setCallbacks({ onResize })
			fromDom({ type: 'resize', instanceId: 'i1', width: 320, height: 180 })
			expect(onResize).toHaveBeenCalledWith(320, 180)
		})

		it('forwards console output', () => {
			const onConsole = jest.fn()
			bridge.setCallbacks({ onConsole })
			fromDom({ type: 'console', instanceId: 'i1', level: 'warn', args: ['slow'] })
			expect(onConsole).toHaveBeenCalledWith('warn', ['slow'])
		})

		it('rebuilds an uncaught error as a real Error', () => {
			const onUncaughtError = jest.fn()
			bridge.setCallbacks({ onUncaughtError })
			fromDom({
				type: 'uncaught-error',
				instanceId: 'i1',
				error: serializeError(new TypeError('render failed')),
			})

			const [error] = onUncaughtError.mock.calls[0] as [Error]
			expect(error).toBeInstanceOf(Error)
			expect(error.name).toBe('TypeError')
			expect(error.message).toBe('render failed')
		})
	})

	it('sends nothing more once disposed', () => {
		bridge.dispose()
		bridge.sendProps({ title: 'Late' }, [])
		expect(dispatched).toHaveLength(0)
	})

	it('works again once reopened, as when React re-runs its effects without unmounting', async () => {
		const save = jest.fn(() => 'saved')
		bridge.setActions({ save: save as never })
		bridge.dispose()
		bridge.open()

		fromDom({ type: 'action-call', instanceId: 'i1', callId: 'c1', action: 'save', args: [] })
		await flush()

		expect(save).toHaveBeenCalledTimes(1)
		expect(lastOfType('result')).toMatchObject({ callId: 'c1', ok: true, value: 'saved' })
	})
})
