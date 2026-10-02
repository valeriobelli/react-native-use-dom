import { findSerializableViolation } from './serializable'
import type { Serializable } from './serializable'

/**
 * How a thrown value is represented on the wire.
 *
 * Expo's DOM components forward only `message` and `stack`; we also carry `name` and the error's
 * own enumerable properties, so that a rejection on one side is recognisable on the other.
 */
export interface WireError {
	name: string
	message: string
	stack?: string
	/** Own enumerable properties of the original error that were themselves serializable. */
	properties?: Record<string, Serializable>
}

const SKIPPED_PROPERTIES = new Set(['name', 'message', 'stack'])

/** Converts anything that was thrown into a payload that survives the boundary. */
export function serializeError(thrown: unknown): WireError {
	if (!(thrown instanceof Error)) {
		return { message: safeStringify(thrown), name: 'Error' }
	}

	const wire: WireError = { message: thrown.message, name: thrown.name }

	if (typeof thrown.stack === 'string') {
		wire.stack = thrown.stack
	}

	const properties: Record<string, Serializable> = {}
	let hasProperties = false

	for (const [key, value] of Object.entries(thrown)) {
		if (SKIPPED_PROPERTIES.has(key)) {
			continue
		}
		// A property that cannot be transferred is dropped rather than turning error reporting itself
		// into an error: the developer is already looking at a failure.

		if (findSerializableViolation(value) !== null) {
			continue
		}

		properties[key] = value as Serializable
		hasProperties = true
	}

	if (hasProperties) {
		wire.properties = properties
	}

	return wire
}

/**
 * Rebuilds an `Error` from a {@link WireError}.
 *
 * The result is always a plain `Error`; the original class does not exist in the receiving runtime.
 * `name` and any own properties are restored so that `error.name === 'TypeError'` and custom fields
 * such as `error.status` still read as they did where the error was thrown.
 */
export function deserializeError(wire: WireError): Error {
	const error = new Error(wire.message)

	Object.defineProperty(error, 'name', {
		configurable: true,
		enumerable: false,
		value: wire.name,
		writable: true,
	})

	if (wire.stack !== undefined) {
		error.stack = wire.stack
	}

	if (wire.properties) {
		Object.assign(error, wire.properties)
	}

	return error
}

function safeStringify(value: unknown): string {
	if (typeof value === 'string') {
		return value
	}

	try {
		return JSON.stringify(value) ?? String(value)
	} catch {
		return String(value)
	}
}
