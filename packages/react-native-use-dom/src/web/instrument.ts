import type { ConsoleMessage } from '../runtime/protocol';
import type { DomBridge } from './bridge';

type ConsoleLevel = ConsoleMessage['level'];

const FORWARDED_LEVELS: readonly ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

/**
 * Forwards this page's console output to the native side so it lands in the app's terminal
 * alongside the rest of the app's logs (E8-AC6).
 *
 * The original methods keep running, so the Web Inspector still shows everything it would.
 */
export function forwardConsole(bridge: DomBridge): () => void {
	const originals = new Map<ConsoleLevel, (...args: unknown[]) => void>();

	for (const level of FORWARDED_LEVELS) {
		const original = console[level].bind(console) as (...args: unknown[]) => void;
		originals.set(level, original);
		console[level] = (...args: unknown[]) => {
			original(...args);
			bridge.reportConsole(level, args);
		};
	}

	return () => {
		for (const [level, original] of originals) console[level] = original;
	};
}

/**
 * Reports errors that escape the DOM component, so they surface in the app instead of leaving a
 * blank view (E8-AC9).
 */
export function reportUncaughtErrors(bridge: DomBridge): () => void {
	const onError = (event: ErrorEvent) => {
		bridge.reportUncaughtError(event.error ?? event.message);
	};
	const onRejection = (event: PromiseRejectionEvent) => {
		bridge.reportUncaughtError(event.reason);
	};

	globalThis.addEventListener('error', onError);
	globalThis.addEventListener('unhandledrejection', onRejection);

	return () => {
		globalThis.removeEventListener('error', onError);
		globalThis.removeEventListener('unhandledrejection', onRejection);
	};
}

/**
 * Reports the rendered content's size so a `matchContents` component can resize itself (E6-AC1).
 *
 * `ResizeObserver` covers late layout shifts — a web font arriving, an image decoding — which a
 * one-shot measurement after mount would miss.
 */
export function reportContentSize(bridge: DomBridge, element: HTMLElement): () => void {
	const measure = () => {
		const rect = element.getBoundingClientRect();
		bridge.reportSize(rect.width, rect.height);
	};

	if (typeof ResizeObserver === 'undefined') {
		measure();
		return noop;
	}

	const observer = new ResizeObserver(measure);
	observer.observe(element);
	return () => {
		observer.disconnect();
	};
}

function noop(): void {}
