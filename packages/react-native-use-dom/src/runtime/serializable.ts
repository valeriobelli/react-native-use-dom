import { DomError } from './errors'
import type { DomErrorCode } from './errors'

/** A value that survives the trip between the native runtime and the DOM runtime unchanged. */
export type Serializable =
	| string
	| number
	| boolean
	| null
	| undefined
	| readonly Serializable[]
	| { readonly [key: string]: Serializable }

/**
 * Why a value was rejected, with the path to the offending member.
 * `path` is written the way a developer would read it: `user.tags[2]`.
 */
export interface SerializableViolation {
	path: string
	reason: string
	/**
	 * `function` when a function was found somewhere other than a top-level prop. Callers surface
	 * that case under its own error code, because the fix is different: hoist it, do not remove it.
	 */
	kind: 'function' | 'value'
}

const MAX_DEPTH = 64

function describe(value: unknown): string {
	if (value === null) {
		return 'null'
	}

	if (Array.isArray(value)) {
		return 'an array'
	}

	if (typeof value === 'object') {
		const { constructor } = value as { constructor?: { name?: string } }
		const name = constructor?.name

		return name && name !== 'Object' ? `an instance of ${name}` : 'an object'
	}

	if (typeof value === 'number') {
		return Number.isNaN(value) ? 'NaN' : String(value)
	}

	return `a ${typeof value}`
}

function isPlainObject(value: object): boolean {
	const proto: unknown = Object.getPrototypeOf(value)

	return proto === Object.prototype || proto === null
}

function join(path: string, key: string | number): string {
	if (typeof key === 'number') {
		return `${path}[${key}]`
	}

	return path === '' ? key : `${path}.${key}`
}

/** A value at `path` that cannot cross the boundary for the given reason. */
function valueRejection(path: string, reason: string): SerializableViolation {
	return { kind: 'value', path, reason }
}

/** Walks the members of a container, returning the first violation among them, if any. */
function findContainerViolation(
	value: object,
	members: Iterable<readonly [string | number, unknown]>,
	path: string,
	seen: Set<object>,
	depth: number,
): SerializableViolation | null {
	seen.add(value)

	for (const [key, member] of members) {
		const violation = findSerializableViolation(member, join(path, key), seen, depth + 1)

		if (violation) {
			return violation
		}
	}

	seen.delete(value)

	return null
}

function findPrimitiveViolation(value: unknown, path: string): SerializableViolation | null {
	switch (typeof value) {
		case 'string':
		case 'boolean':
		case 'undefined':
			return null
		case 'number':
			return Number.isFinite(value)
				? null
				: { kind: 'value', path, reason: `${describe(value)} has no JSON representation` }
		case 'bigint':
			return {
				kind: 'value',
				path,
				reason: 'a bigint has no JSON representation; send a string instead',
			}
		case 'symbol':
			return { kind: 'value', path, reason: 'a symbol cannot be transferred' }
		case 'function':
		case 'object':
			return {
				kind: 'function',
				path,
				reason: 'functions are only supported as top-level props, where they become async native actions',
			}
	}

	// Unreachable: every `typeof` result is handled above. Returned for linters that cannot see the
	// exhaustiveness of a `typeof` switch.
	return null
}

/**
 * Walks `value` and returns the first reason it cannot cross the boundary, or `null` if it can.
 *
 * Values that JSON silently corrupts (`NaN`, `Infinity`, `Date`, `Map`) are rejected rather than
 * quietly rewritten, so a mistake surfaces at the call site instead of as wrong data in the DOM.
 */
export function findSerializableViolation(
	value: unknown,
	path = '',
	seen: Set<object> = new Set(),
	depth = 0,
): SerializableViolation | null {
	if (depth > MAX_DEPTH) {
		return valueRejection(path, `nesting is deeper than ${MAX_DEPTH} levels`)
	}

	if (typeof value !== 'object') {
		return findPrimitiveViolation(value, path)
	}

	if (value === null) {
		return null
	}

	if (seen.has(value)) {
		return valueRejection(path, 'the value is circular')
	}

	if (Array.isArray(value)) {
		return findContainerViolation(
			value,
			Array.from({ length: value.length }, (_, index) => [index, value[index]] as const),
			path,
			seen,
			depth,
		)
	}

	if (!isPlainObject(value)) {
		return valueRejection(path, `${describe(value)} cannot be transferred; convert it to a plain object first`)
	}

	return findContainerViolation(value, Object.entries(value), path, seen, depth)
}

/** Whether `value` can cross the boundary unchanged. */
export function isSerializable(value: unknown): value is Serializable {
	return findSerializableViolation(value) === null
}

/**
 * Throws a {@link DomError} unless `value` can cross the boundary.
 *
 * @param label how the value should be named in the error, e.g. `prop "options"`.
 */
export function assertSerializable(
	value: unknown,
	label: string,
	code:
		| typeof DomErrorCode.NonSerializableProp
		| typeof DomErrorCode.NonSerializableArgument
		| typeof DomErrorCode.NonSerializableResult,
): asserts value is Serializable {
	const violation = findSerializableViolation(value)

	if (!violation) {
		return
	}

	const where = violation.path === '' ? label : `${label} at \`${violation.path}\``

	throw new DomError(code, `${where} cannot be sent to a DOM component: ${violation.reason}.`, {
		fix: 'DOM components exchange JSON-compatible values only: strings, finite numbers, booleans, null, arrays and plain objects.',
	})
}
