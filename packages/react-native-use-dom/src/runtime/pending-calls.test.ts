import { DomErrorCode } from './errors';
import { PendingCalls } from './pending-calls';
import type { ResultMessage } from './protocol';
import { serializeError } from './wire-error';

const ok = (callId: string, value: unknown): ResultMessage =>
	({ type: 'result', instanceId: 'i1', callId, ok: true, value }) as ResultMessage;

const failed = (callId: string, error: Error): ResultMessage => ({
	type: 'result',
	instanceId: 'i1',
	callId,
	ok: false,
	error: serializeError(error),
});

describe('PendingCalls', () => {
	it('resolves a call with its own value', async () => {
		const calls = new PendingCalls();
		const { callId, result } = calls.create();
		calls.settle(ok(callId, 42));
		await expect(result).resolves.toBe(42);
	});

	it('gives every call a distinct id', () => {
		const calls = new PendingCalls();
		const ids = new Set([calls.create().callId, calls.create().callId, calls.create().callId]);
		expect(ids.size).toBe(3);
	});

	it('routes results to the right caller when they arrive out of order', async () => {
		const calls = new PendingCalls();
		const first = calls.create();
		const second = calls.create();
		const third = calls.create();

		calls.settle(ok(third.callId, 'third'));
		calls.settle(ok(first.callId, 'first'));
		calls.settle(ok(second.callId, 'second'));

		await expect(Promise.all([first.result, second.result, third.result])).resolves.toEqual([
			'first',
			'second',
			'third',
		]);
	});

	it('rejects with an error that kept its name and properties', async () => {
		const calls = new PendingCalls();
		const { callId, result } = calls.create();
		calls.settle(failed(callId, Object.assign(new TypeError('nope'), { status: 418 })));

		await expect(result).rejects.toMatchObject({
			name: 'TypeError',
			message: 'nope',
			status: 418,
		});
	});

	it('reports whether a result matched a call', () => {
		const calls = new PendingCalls();
		const { callId } = calls.create();
		expect(calls.settle(ok(callId, 1))).toBe(true);
		expect(calls.settle(ok(callId, 1))).toBe(false);
		expect(calls.settle(ok('never-issued', 1))).toBe(false);
	});

	it('forgets a call once it settles', async () => {
		const calls = new PendingCalls();
		const { callId, result } = calls.create();
		expect(calls.size).toBe(1);
		calls.settle(ok(callId, null));
		await result;
		expect(calls.size).toBe(0);
	});

	it('rejects everything outstanding when the bridge closes', async () => {
		const calls = new PendingCalls();
		const first = calls.create();
		const second = calls.create();

		calls.abortAll('the component unmounted');

		await expect(first.result).rejects.toMatchObject({ code: DomErrorCode.BridgeClosed });
		await expect(second.result).rejects.toThrow(/the component unmounted/u);
		expect(calls.size).toBe(0);
	});
});
