import { DomError } from './errors';
import type { DomErrorCode } from './errors';

/** A value that survives the trip between the native runtime and the DOM runtime unchanged. */
export type Serializable =
	| string
	| number
	| boolean
	| null
	| undefined
	| readonly Serializable[]
	| { readonly [key: string]: Serializable };

/**
 * Why a value was rejected, with the path to the offending member.
 * `path` is written the way a developer would read it: `user.tags[2]`.
 */
export interface SerializableViolation {
	path: string;
	reason: string;
	/**
	 * `function` when a function was found somewhere other than a top-level prop. Callers surface
	 * that case under its own error code, because the fix is different: hoist it, do not remove it.
	 */
	kind: 'function' | 'value';
}

const MAX_DEPTH = 64;

function describe(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'an array';
	const type = typeof value;
	if (type === 'object') {
		const name = (value as object).constructor?.name;
		return name && name !== 'Object' ? `an instance of ${name}` : 'an object';
	}
	if (type === 'number') return Number.isNaN(value) ? 'NaN' : String(value);
	return `a ${type}`;
}

function isPlainObject(value: object): boolean {
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function join(path: string, key: string | number): string {
	if (typeof key === 'number') return `${path}[${key}]`;
	return path === '' ? key : `${path}.${key}`;
}

function findPrimitiveViolation(value: unknown, path: string): SerializableViolation | null {
	switch (typeof value) {
		case 'string':
		case 'boolean':
		case 'undefined':
			return null;
		case 'number':
			return Number.isFinite(value)
				? null
				: { path, reason: `${describe(value)} has no JSON representation`, kind: 'value' };
		case 'bigint':
			return {
				path,
				reason: 'a bigint has no JSON representation; send a string instead',
				kind: 'value',
			};
		case 'symbol':
			return { path, reason: 'a symbol cannot be transferred', kind: 'value' };
		default:
			return {
				path,
				reason: 'functions are only supported as top-level props, where they become async native actions',
				kind: 'function',
			};
	}
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
		return { path, reason: `nesting is deeper than ${MAX_DEPTH} levels`, kind: 'value' };
	}

	if (typeof value !== 'object') return findPrimitiveViolation(value, path);
	if (value === null) return null;

	if (seen.has(value)) return { path, reason: 'the value is circular', kind: 'value' };

	if (Array.isArray(value)) {
		seen.add(value);
		for (let index = 0; index < value.length; index += 1) {
			const violation = findSerializableViolation(value[index], join(path, index), seen, depth + 1);
			if (violation) return violation;
		}
		seen.delete(value);
		return null;
	}

	if (!isPlainObject(value)) {
		return {
			path,
			reason: `${describe(value)} cannot be transferred; convert it to a plain object first`,
			kind: 'value',
		};
	}

	seen.add(value);
	for (const [key, member] of Object.entries(value)) {
		const violation = findSerializableViolation(member, join(path, key), seen, depth + 1);
		if (violation) return violation;
	}
	seen.delete(value);
	return null;
}

/** Whether `value` can cross the boundary unchanged. */
export function isSerializable(value: unknown): value is Serializable {
	return findSerializableViolation(value) === null;
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
	const violation = findSerializableViolation(value);
	if (!violation) return;

	const where = violation.path === '' ? label : `${label} at \`${violation.path}\``;
	throw new DomError(code, `${where} cannot be sent to a DOM component: ${violation.reason}.`, {
		fix: 'DOM components exchange JSON-compatible values only: strings, finite numbers, booleans, null, arrays and plain objects.',
	});
}
