// Neither module ships type declarations. These cover what the development client uses.

declare module 'metro-runtime/modules/HMRClient' {
	/** Metro's client for its hot module replacement socket. It applies the updates it receives once enabled. */
	class HMRClient {
		constructor(url: string);
		send(message: string): void;
		enable(): void;
		close(): void;
		on(event: 'open' | 'update-done', listener: () => void): this;
		on(event: 'update-start', listener: (body: { isInitialUpdate: boolean }) => void): this;
		on(event: 'update', listener: (body: HMRClient.HmrUpdate) => void): this;
		on(event: 'error', listener: (body: HMRClient.HmrError) => void): this;
		on(event: 'close', listener: () => void): this;
	}

	namespace HMRClient {
		/** A change Metro sends over its hot module replacement socket. */
		interface HmrUpdate {
			isInitialUpdate: boolean;
			added: readonly unknown[];
			modified: readonly unknown[];
			deleted: readonly unknown[];
		}

		/** A build error, as Metro formats it for its clients. */
		interface HmrError {
			type: string;
			message: string;
			errors?: readonly { description?: string; filename?: string; lineNumber?: number }[];
		}
	}

	export = HMRClient;
}

declare module 'react-refresh/runtime' {
	export function injectIntoGlobalHook(globalObject: typeof globalThis): void;
	export function register(type: unknown, id: string): void;
	export function createSignatureFunctionForTransform(): (type: unknown, key: string, ...rest: unknown[]) => unknown;
	export function isLikelyComponentType(value: unknown): boolean;
	export function getFamilyByType(type: unknown): unknown;
	export function performReactRefresh(): unknown;
	export function hasUnrecoverableErrors(): boolean;
}
