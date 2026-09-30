/**
 * Types for the React Native internals this library reaches into.
 *
 * React Native 0.87 maps `./Libraries/*` to `"types": null` in its exports field, so these deep
 * imports are untyped by design. Declaring them here keeps the contract we depend on written down
 * in one place — which is also what the bundler-contract smoke test checks against.
 */

declare module 'react-native/Libraries/Core/Devtools/getDevServer' {
	interface DevServerInfo {
		/** The dev server's origin, with a trailing slash. Falls back to `http://localhost:8081/`. */
		url: string;
		/** The full bundle URL the app was loaded from, or `null` in a release build. */
		fullBundleUrl: string | null;
		/** Whether the running bundle came from a dev server rather than from the app binary. */
		bundleLoadedFromServer: boolean;
	}

	export default function getDevServer(): DevServerInfo;
}
