import { useEffect } from 'react';

import type { Serializable } from '../runtime/serializable';
import type { DomBridge } from './bridge';
import { useDomBridge } from './context';

/**
 * A method a DOM component exposes to the native side. Arguments and the resolved value must be
 * JSON-serializable; a method that returns nothing resolves with `null`.
 */
export type DomHandleMethod = (...args: never[]) => Serializable | undefined | Promise<Serializable | undefined>;

/** The object a DOM component exposes through its native `ref`. */
export type DomHandle = Record<string, DomHandleMethod>;

/**
 * Exposes methods on this DOM component's native `ref`, the DOM-side counterpart of React's
 * `useImperativeHandle`.
 *
 * Native code awaits every call, because it crosses into the WebView:
 *
 * ```tsx
 * 'use dom';
 *
 * export default function Editor() {
 *   const [text, setText] = useState('');
 *   useDOMImperativeHandle(() => ({
 *     getText: () => text,
 *     clear: () => setText(''),
 *   }), [text]);
 *   return <textarea value={text} onChange={(event) => setText(event.target.value)} />;
 * }
 * ```
 *
 * ```tsx
 * const ref = useRef<DomComponentRef<typeof Editor>>(null);
 * const text = await ref.current?.getText();
 * ```
 *
 * The methods are replaced whenever `deps` change, so a method always closes over the render it was
 * created in. A method that throws rejects the native caller's promise with the same error.
 */
export function useDOMImperativeHandle<THandle extends DomHandle>(
	create: () => THandle,
	deps: readonly unknown[],
): void {
	const bridge: DomBridge = useDomBridge('useDOMImperativeHandle');

	useEffect(() => {
		bridge.setHandle(create());
		return () => {
			bridge.setHandle(null);
		};
		// The caller owns the dependency list, exactly as with `useImperativeHandle`.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [bridge, ...deps]);
}
