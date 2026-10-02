import { useEffect } from 'react'

import type { Serializable } from '../runtime/serializable'
import type { DomBridge } from './bridge'
import { useDomBridge } from './context'

/**
 * A method a DOM component exposes to the native side. Arguments and the resolved value must be
 * JSON-serializable; a method that returns nothing resolves with `null`.
 */
export type DomHandleMethod = (...args: never[]) => Serializable | void | Promise<Serializable | void>

/** The object a DOM component exposes through its native `ref`. */
export type DomHandle = Record<string, DomHandleMethod>

/**
 * Exposes methods on this DOM component's native `ref`, the DOM-side counterpart of React's
 * `useImperativeHandle`.
 *
 * Native code awaits every call, because it crosses into the WebView:
 *
 * ```tsx
 * 'use dom';
 *
 * import type { DomProps, DomRef } from 'react-native-use-dom';
 *
 * export interface EditorHandle {
 *   getText(): string;
 *   clear(): void;
 * }
 *
 * export default function Editor(_: { ref?: DomRef<EditorHandle>; dom?: DomProps }) {
 *   const [text, setText] = useState('');
 *   useDOMImperativeHandle<EditorHandle>(() => ({
 *     getText: () => text,
 *     clear: () => setText(''),
 *   }), [text]);
 *   return <textarea value={text} onChange={(event) => setText(event.target.value)} />;
 * }
 * ```
 *
 * ```tsx
 * const editor = useRef<DomRefHandle<EditorHandle>>(null);
 * const text = await editor.current?.getText();
 * ```
 *
 * The methods are replaced whenever `deps` change, so a method always closes over the render it was
 * created in. A method that throws rejects the native caller's promise with the same error.
 */
export function useDOMImperativeHandle<THandle extends { [K in keyof THandle]: DomHandleMethod }>(
	create: () => THandle,
	deps: readonly unknown[],
): void {
	const bridge: DomBridge = useDomBridge('useDOMImperativeHandle')

	useEffect(() => {
		// Every key holds a method, which is all an index signature would add.
		bridge.setHandle(create())

		return () => {
			bridge.setHandle(null)
		}
		// The caller owns the dependency list, exactly as with `useImperativeHandle`.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [bridge, ...deps])
}
