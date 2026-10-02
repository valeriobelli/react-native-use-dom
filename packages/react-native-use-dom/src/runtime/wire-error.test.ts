import { deserializeError, serializeError } from './wire-error'

describe('serializeError', () => {
	it('carries name, message and stack', () => {
		const wire = serializeError(new TypeError('bad input'))

		expect(wire.name).toBe('TypeError')
		expect(wire.message).toBe('bad input')
		expect(wire.stack).toContain('bad input')
	})

	it('carries own enumerable properties', () => {
		const error = Object.assign(new Error('request failed'), { status: 404, url: '/users' })

		expect(serializeError(error).properties).toEqual({ status: 404, url: '/users' })
	})

	it('omits the properties field when there are none', () => {
		expect(serializeError(new Error('plain')).properties).toBeUndefined()
	})

	it('drops a property that cannot itself be transferred, rather than failing', () => {
		const error = Object.assign(new Error('boom'), { at: new Date(0), code: 'E_BOOM' })

		expect(serializeError(error).properties).toEqual({ code: 'E_BOOM' })
	})

	it('handles a thrown string', () => {
		expect(serializeError('just a string')).toEqual({ message: 'just a string', name: 'Error' })
	})

	it('handles a thrown plain object', () => {
		expect(serializeError({ a: 1 })).toEqual({ message: '{"a":1}', name: 'Error' })
	})

	it('handles a thrown circular object without crashing', () => {
		const value: Record<string, unknown> = {}

		value['self'] = value
		expect(serializeError(value).message).toBe('[object Object]')
	})

	it('handles a thrown undefined', () => {
		expect(serializeError(undefined)).toEqual({ message: 'undefined', name: 'Error' })
	})
})

describe('deserializeError', () => {
	it('round-trips an error so it reads the same on the other side', () => {
		const original = Object.assign(new TypeError('bad input'), { status: 400 })
		const restored = deserializeError(serializeError(original))

		expect(restored).toBeInstanceOf(Error)
		expect(restored.name).toBe('TypeError')
		expect(restored.message).toBe('bad input')
		expect(restored.stack).toBe(original.stack)
		expect((restored as unknown as { status: number }).status).toBe(400)
	})

	it('keeps name non-enumerable, as a real Error does', () => {
		const restored = deserializeError({ message: 'x', name: 'RangeError' })

		expect(Object.keys(restored)).not.toContain('name')
		expect(String(restored)).toBe('RangeError: x')
	})

	it('leaves the stack alone when none was sent', () => {
		const restored = deserializeError({ message: 'no stack', name: 'Error' })

		expect(restored.message).toBe('no stack')
	})
})
