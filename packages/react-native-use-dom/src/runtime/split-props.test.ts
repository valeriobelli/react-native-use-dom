import { DomErrorCode } from './errors';
import type { DomError } from './errors';
import { splitProps } from './split-props';

function capture(run: () => unknown): DomError {
	try {
		run();
	} catch (error) {
		return error as DomError;
	}
	throw new Error('expected the call to throw, but it returned');
}

describe('splitProps', () => {
	it('sends serializable props as data', () => {
		const { data, actions } = splitProps({ title: 'Hi', count: 2, tags: ['a'] }, 'Chart');
		expect(data).toEqual({ title: 'Hi', count: 2, tags: ['a'] });
		expect(actions).toEqual({});
	});

	it('keeps top-level functions as actions rather than sending them', () => {
		const onSave = jest.fn();
		const { data, actions } = splitProps({ title: 'Hi', onSave }, 'Chart');
		expect(data).toEqual({ title: 'Hi' });
		expect(actions['onSave']).toBe(onSave);
	});

	it('keeps props the host consumes itself out of both halves', () => {
		const { data, actions } = splitProps({ dom: { matchContents: true }, key: 'k', title: 'Hi' }, 'Chart');
		expect(data).toEqual({ title: 'Hi' });
		expect(actions).toEqual({});
	});

	it('passes undefined and null through as data', () => {
		const { data } = splitProps({ a: undefined, b: null }, 'Chart');
		expect(data).toEqual({ a: undefined, b: null });
	});

	it('rejects children, naming the component', () => {
		const error = capture(() => splitProps({ children: 'text' }, 'Chart'));
		expect(error.code).toBe(DomErrorCode.ChildrenUnsupported);
		expect(error.message).toContain('<Chart> was given children');
	});

	it('allows an explicitly undefined children prop, which React passes routinely', () => {
		expect(() => splitProps({ children: undefined, title: 'Hi' }, 'Chart')).not.toThrow();
	});

	it('rejects a nested function under its own code, with the path', () => {
		const error = capture(() => splitProps({ handlers: { onSave: () => {} } }, 'Chart'));
		expect(error.code).toBe(DomErrorCode.NestedFunctionProp);
		expect(error.message).toContain('prop `handlers.onSave`');
		expect(error.fix).toContain('Only top-level function props');
	});

	it('rejects a non-serializable prop, naming the prop and the reason', () => {
		const error = capture(() => splitProps({ startedAt: new Date(0) }, 'Chart'));
		expect(error.code).toBe(DomErrorCode.NonSerializableProp);
		expect(error.message).toContain('prop `startedAt`');
		expect(error.message).toContain('an instance of Date');
	});

	it('names the nested path when the failure is deep', () => {
		const error = capture(() => splitProps({ user: { tags: [new Map()] } }, 'Chart'));
		expect(error.message).toContain('prop `user.tags[0]`');
	});
});
