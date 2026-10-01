import { DomError, DomErrorCode } from './errors'
import { assertSerializable, findSerializableViolation, isSerializable } from './serializable'

describe('findSerializableViolation', () => {
	it.each([
		['a string', 'hello'],
		['a finite number', 42],
		['zero', 0],
		['a boolean', false],
		['null', null],
		['undefined', undefined],
		['an empty object', {}],
		['an empty array', []],
		['a nested plain structure', { a: [1, { b: ['c', null] }], d: true }],
		['an object with a null prototype', Object.assign(Object.create(null), { a: 1 })],
	])('accepts %s', (_label, value) => {
		expect(findSerializableViolation(value)).toBeNull()
		expect(isSerializable(value)).toBe(true)
	})

	it.each([
		['NaN', Number.NaN, 'NaN has no JSON representation'],
		['Infinity', Number.POSITIVE_INFINITY, 'has no JSON representation'],
		['a bigint', 10n, 'a bigint has no JSON representation'],
		['a symbol', Symbol('s'), 'a symbol cannot be transferred'],
		['a Date', new Date(0), 'an instance of Date cannot be transferred'],
		['a Map', new Map(), 'an instance of Map cannot be transferred'],
		['a Set', new Set(), 'an instance of Set cannot be transferred'],
		['a RegExp', /x/u, 'an instance of RegExp cannot be transferred'],
	])('rejects %s', (_label, value, reason) => {
		expect(findSerializableViolation(value)?.reason).toContain(reason)
		expect(isSerializable(value)).toBe(false)
	})

	it('rejects a class instance by name', () => {
		class Widget {}
		expect(findSerializableViolation(new Widget())?.reason).toContain('an instance of Widget')
	})

	it('reports the path to the offending member, the way a developer reads it', () => {
		const value = { user: { tags: ['a', 'b', new Date(0)] } }
		expect(findSerializableViolation(value)?.path).toBe('user.tags[2]')
	})

	it('reports a nested function as a function, not as an object', () => {
		const violation = findSerializableViolation({ handlers: { onSave: () => {} } })
		expect(violation?.path).toBe('handlers.onSave')
		expect(violation?.reason).toContain('only supported as top-level props')
	})

	it('detects a circular object without hanging', () => {
		const value: Record<string, unknown> = { name: 'a' }
		value['self'] = value
		expect(findSerializableViolation(value)).toEqual({
			path: 'self',
			reason: 'the value is circular',
			kind: 'value',
		})
	})

	it('detects a circular array without hanging', () => {
		const value: unknown[] = [1]
		value.push(value)
		expect(findSerializableViolation(value)?.reason).toBe('the value is circular')
	})

	it('allows the same object to appear twice side by side', () => {
		const shared = { a: 1 }
		expect(findSerializableViolation({ left: shared, right: shared })).toBeNull()
	})

	it('rejects structures nested beyond the depth limit', () => {
		let value: unknown = 'leaf'
		for (let i = 0; i < 80; i += 1) value = { next: value }
		expect(findSerializableViolation(value)?.reason).toContain('deeper than')
	})
})

function capture(run: () => void): DomError {
	try {
		run()
	} catch (error) {
		return error as DomError
	}
	throw new Error('expected the call to throw, but it returned')
}

describe('assertSerializable', () => {
	it('passes a valid value through', () => {
		expect(() => assertSerializable({ a: 1 }, 'prop "x"', DomErrorCode.NonSerializableProp)).not.toThrow()
	})

	it('throws a DomError carrying the code it was given', () => {
		const error = capture(() => assertSerializable(new Date(0), 'prop "startedAt"', DomErrorCode.NonSerializableProp))
		expect(error).toBeInstanceOf(DomError)
		expect(error.code).toBe(DomErrorCode.NonSerializableProp)
		expect(error.message).toContain('prop "startedAt" cannot be sent')
	})

	it('names the path when the failure is nested', () => {
		expect(() =>
			assertSerializable({ a: { b: new Map() } }, 'argument 1', DomErrorCode.NonSerializableArgument),
		).toThrow(/argument 1 at `a\.b`/u)
	})

	it('states the concrete fix', () => {
		const error = capture(() => assertSerializable(10n, 'prop "id"', DomErrorCode.NonSerializableProp))
		expect(error.fix).toContain('JSON-compatible values only')
	})
})
