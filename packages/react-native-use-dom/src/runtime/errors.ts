/**
 * Every error this library throws carries a stable `code`. Codes are part of the public contract:
 * they are documented, greppable, and safe to branch on. Messages are not — they may be reworded.
 *
 * Adding a code here is the only supported way to introduce a new failure mode. Each code is
 * documented in `../docs/errors.ts`, which `docs/errors.md` is generated from, and a test asserts
 * the two never drift.
 */
export const DomErrorCode = {
	/** The WebView went away while a call was in flight. */
	BridgeClosed: 'ERR_USE_DOM_BRIDGE_CLOSED',
	/** A DOM component was rendered with `children`, which cannot cross the boundary. */
	ChildrenUnsupported: 'ERR_USE_DOM_CHILDREN_UNSUPPORTED',
	/** The app runs in Expo Go, which does not include the library's native view. */
	ExpoGoUnsupported: 'ERR_USE_DOM_EXPO_GO_UNSUPPORTED',
	/** A `'use dom'` module exported something other than a single default export. */
	InvalidModuleExports: 'ERR_USE_DOM_INVALID_MODULE_EXPORTS',
	/** A message arrived that does not match the wire protocol. */
	MalformedMessage: 'ERR_USE_DOM_MALFORMED_MESSAGE',
	/** A release build did not say where the app's resources go, so its DOM component pages had nowhere to be written. */
	MissingBundleOutput: 'ERR_USE_DOM_MISSING_BUNDLE_OUTPUT',
	/** The project's Metro config was never wrapped with `withDom()`. */
	MissingMetroConfig: 'ERR_USE_DOM_MISSING_METRO_CONFIG',
	/** A function was nested inside an object or array prop rather than passed at the top level. */
	NestedFunctionProp: 'ERR_USE_DOM_NESTED_FUNCTION_PROP',
	/** An argument passed to a native action cannot be represented in the wire format. */
	NonSerializableArgument: 'ERR_USE_DOM_NON_SERIALIZABLE_ARGUMENT',
	/** A prop's value cannot be represented in the wire format. */
	NonSerializableProp: 'ERR_USE_DOM_NON_SERIALIZABLE_PROP',
	/** A native action's return value cannot be represented in the wire format. */
	NonSerializableResult: 'ERR_USE_DOM_NON_SERIALIZABLE_RESULT',
	/** A `'use dom'` module imported `react-native`, which does not exist in a browser context. */
	ReactNativeImportInDom: 'ERR_USE_DOM_REACT_NATIVE_IMPORT',
	/** The DOM side called a native action that is not among the component's current props. */
	UnknownAction: 'ERR_USE_DOM_UNKNOWN_ACTION',
	/** The dev server was asked to build a DOM component from a file outside the project. */
	UnknownDomComponent: 'ERR_USE_DOM_UNKNOWN_COMPONENT',
	/** Native called a ref method the DOM component never exposed. */
	UnknownHandleMethod: 'ERR_USE_DOM_UNKNOWN_HANDLE_METHOD',
} as const

export type DomErrorCode = (typeof DomErrorCode)[keyof typeof DomErrorCode]

/** What a {@link DomError} carries beyond its code and message. */
export interface DomErrorOptions {
	/** The underlying error, preserved for the stack trace. */
	cause?: unknown
	/** The concrete next action the developer should take. Rendered after the message. */
	fix?: string
}

/**
 * The error type raised across this library.
 *
 * @example
 * ```ts
 * try {
 *   await chart.exportPng();
 * } catch (error) {
 *   if (error instanceof DomError && error.code === DomErrorCode.BridgeClosed) {
 *     // the screen was dismissed mid-call; nothing to report
 *   }
 * }
 * ```
 */
export class DomError extends Error {
	override readonly name = 'DomError'
	readonly code: DomErrorCode
	readonly fix: string | undefined

	constructor(code: DomErrorCode, message: string, options: DomErrorOptions = {}) {
		super(options.fix ? `${message}\n\n${options.fix}` : message, { cause: options.cause })
		this.code = code
		this.fix = options.fix
	}
}

/** Narrows an unknown value to a {@link DomError}, including across a realm boundary. */
export function isDomError(value: unknown): value is DomError {
	if (!(value instanceof Error)) {
		return false
	}

	const code: unknown = (value as Error & { code?: unknown }).code

	return typeof code === 'string' && code.startsWith('ERR_USE_DOM_')
}
