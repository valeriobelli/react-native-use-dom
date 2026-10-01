import { DomError, DomErrorCode } from './errors';
import { findSerializableViolation } from './serializable';
import type { Serializable } from './serializable';

/** A function prop, which the DOM side calls as an async native action. */
export type NativeAction = (...args: never[]) => unknown;

/** A DOM component's props, as {@link splitProps} separates them. */
export interface SplitProps {
	/** Props sent to the DOM runtime as data. */
	data: Record<string, Serializable>;
	/** Function props, callable from the DOM side by name. */
	actions: Record<string, NativeAction>;
}

/** Props the host component consumes itself and never forwards. */
const RESERVED = new Set(['dom', 'children', 'ref', 'key']);

/**
 * Separates a DOM component's props into the data that is sent across and the functions that stay
 * on the native side as callable actions.
 *
 * @param props the props the component was rendered with.
 * @param componentName how the component should be named in any error, e.g. the source file's base
 * name, so the developer can find it without a stack trace.
 *
 * @throws {DomError} with {@link DomErrorCode.ChildrenUnsupported}, {@link DomErrorCode.NestedFunctionProp}
 * or {@link DomErrorCode.NonSerializableProp}.
 */
export function splitProps(props: Record<string, unknown>, componentName: string): SplitProps {
	if (props['children'] !== undefined) {
		throw new DomError(
			DomErrorCode.ChildrenUnsupported,
			`<${componentName}> was given children, but a DOM component cannot receive them.`,
			{
				fix: 'React elements cannot cross into the DOM runtime. Pass the content as a serializable prop, or move the markup inside the DOM component.',
			},
		);
	}

	const data: Record<string, Serializable> = {};
	const actions: Record<string, NativeAction> = {};

	for (const [name, value] of Object.entries(props)) {
		if (RESERVED.has(name)) continue;

		if (typeof value === 'function') {
			actions[name] = value as NativeAction;
			continue;
		}

		const violation = findSerializableViolation(value);
		if (violation === null) {
			data[name] = value as Serializable;
			continue;
		}

		const where = violation.path === '' ? `prop \`${name}\`` : `prop \`${name}.${violation.path}\``;
		if (violation.kind === 'function') {
			throw new DomError(
				DomErrorCode.NestedFunctionProp,
				`<${componentName}> received a function at ${where}, which cannot be called from the DOM side.`,
				{
					fix: 'Only top-level function props become native actions. Pass it as its own prop instead of nesting it.',
				},
			);
		}

		throw new DomError(
			DomErrorCode.NonSerializableProp,
			`<${componentName}> received a value at ${where} that cannot be sent to a DOM component: ${violation.reason}.`,
			{
				fix: 'DOM components exchange JSON-compatible values only: strings, finite numbers, booleans, null, arrays and plain objects.',
			},
		);
	}

	return { data, actions };
}
