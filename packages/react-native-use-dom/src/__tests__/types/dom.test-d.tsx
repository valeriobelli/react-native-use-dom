// Type tests: checked by `pnpm typecheck`, never run. Each `@ts-expect-error` must flag a real error.
import type { Serializable } from '../../web'
import { useDOMImperativeHandle } from '../../web'

export function HandleMethodsExchangeSerializableValues() {
	useDOMImperativeHandle<{ getText(): string; clear(): void; load(id: number): Promise<{ title: string }> }>(
		() => ({ getText: () => '', clear: () => {}, load: async () => ({ title: '' }) }),
		[],
	)
	// @ts-expect-error a Date does not survive the trip to the native side
	useDOMImperativeHandle<{ now(): Date }>(() => ({ now: () => new Date() }), [])
	// @ts-expect-error a function cannot be sent back
	useDOMImperativeHandle<{ later(): () => void }>(() => ({ later: () => () => {} }), [])
	// @ts-expect-error every member of a handle is a method
	useDOMImperativeHandle<{ count: number }>(() => ({ count: 1 }), [])
	return null
}

export const values: Serializable[] = ['a', 1, true, null, undefined, [1, 'b'], { nested: { list: [null] } }]

// @ts-expect-error a Map is not serializable
export const map: Serializable = new Map<string, string>()

// @ts-expect-error a function is not serializable
export const callback: Serializable = () => {}
