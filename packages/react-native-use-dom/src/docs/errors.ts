import { DomErrorCode } from '../runtime/errors'

/** What `docs/errors.md` says about one error code. */
export interface ErrorDoc {
	/** What the developer sees go wrong. */
	what: string
	/** Why the library refuses or fails. */
	why: string
	/** What to change. */
	fix: string
}

/** The documentation of every error code. The type makes leaving a code out a compile error. */
export const ERROR_DOCS: { readonly [Code in DomErrorCode]: ErrorDoc } = {
	[DomErrorCode.MissingMetroConfig]: {
		fix: "Wrap the config `metro.config.js` exports with `withDom` from `react-native-use-dom/metro`, then rebuild the app. Don't point Metro's `babelTransformerPath` at the library's transformer directly.",
		what: 'A DOM component fails to load in a release build because the app has no page for it. In development, Metro reports that the DOM component transformer ran without its settings.',
		why: "DOM component pages are built and embedded by the Metro integration. Without `withDom()` in `metro.config.js` nothing builds them, and Metro can't build a DOM bundle with the library's transformer configured by hand.",
	},
	[DomErrorCode.MissingBundleOutput]: {
		fix: "Pass `--assets-dest` with the folder the app's resources are copied from. Xcode's “Bundle React Native code and images” build phase and React Native's Gradle plugin already pass it.",
		what: '`react-native bundle` fails for an app that renders DOM components.',
		why: "A release bundle with DOM components writes their pages next to the app's other resources. The command was given no `--assets-dest`, so there is nowhere to write them.",
	},
	[DomErrorCode.ExpoGoUnsupported]: {
		fix: 'Run the app as a [development build](https://docs.expo.dev/develop/development-builds/create-a-build/), built with `npx expo run:ios` or `npx expo run:android`, or with EAS Build.',
		what: 'Rendering a DOM component in Expo Go throws.',
		why: "A DOM component renders in the library's native view, and Expo Go includes only the native code Expo ships with it.",
	},
	[DomErrorCode.InvalidModuleExports]: {
		fix: 'Default-export the React component to render. Move any other value into a separate module that both sides import. Exported types are fine.',
		what: "The build fails on a module marked `'use dom'`.",
		why: "On a native platform a `'use dom'` module is replaced by a component that renders it in a WebView, and only its default export can be replaced that way. Other values it exports would never reach native code, so the module must export only the component, as its default export.",
	},
	[DomErrorCode.ChildrenUnsupported]: {
		fix: 'Pass the content as a serializable prop, such as a string or a list of items, or move the markup inside the DOM component.',
		what: 'Rendering a DOM component with children throws.',
		why: "The DOM component's tree lives in the WebView, and React elements created in native code can't be sent to it.",
	},
	[DomErrorCode.NonSerializableProp]: {
		fix: 'Convert the value to strings, finite numbers, booleans, `null`, arrays and plain objects before passing it, for example a `Date` to its ISO string.',
		what: 'Rendering a DOM component throws, naming the prop and the path to the value it rejected.',
		why: 'Props are sent to the WebView as JSON. A value JSON would lose or change, such as a `Date`, a `Map`, a class instance, `NaN` or a circular object, is refused instead of arriving wrong.',
	},
	[DomErrorCode.NonSerializableArgument]: {
		fix: 'Pass only strings, finite numbers, booleans, `null`, arrays and plain objects.',
		what: 'A call across the boundary rejects before it is sent, because one of its arguments could not be sent.',
		why: 'The arguments of a native action and of a ref method are sent as JSON. A value JSON would lose or change is refused instead of arriving wrong.',
	},
	[DomErrorCode.NonSerializableResult]: {
		fix: 'Return only strings, finite numbers, booleans, `null`, arrays and plain objects, or nothing.',
		what: 'A call across the boundary rejects, because the value it returned could not be sent back.',
		why: 'What a native action or a ref method returns is sent back to the caller as JSON. A value JSON would lose or change is refused instead of arriving wrong.',
	},
	[DomErrorCode.NestedFunctionProp]: {
		fix: 'Pass the function as a prop of its own.',
		what: 'Rendering a DOM component throws, naming the path to a function inside an object or array prop.',
		why: 'Only a top-level function prop becomes a native action that the DOM component can call. A function nested in another value has no way to be called from the WebView.',
	},
	[DomErrorCode.UnknownDomComponent]: {
		fix: 'Render the component through its native proxy, not by opening the page URL. If the component lives outside the project and the Metro server root, add its folder to `watchFolders` in `metro.config.js`.',
		what: 'The dev server refuses to build a DOM component page.',
		why: 'The dev server builds a page only for a component the native view names, and only from a file Metro serves: one in the project, its `watchFolders` or the Metro server root (Expo sets it to the workspace root in a monorepo). That keeps the dev server from bundling arbitrary files on request.',
	},
	[DomErrorCode.ReactNativeImportInDom]: {
		fix: 'Use DOM elements and web libraries inside the DOM component. For a native capability, pass a function prop from the native side and call it from the DOM component.',
		what: 'The build of a DOM component fails, naming the module that imports `react-native` or one of its libraries.',
		why: 'A DOM component runs in a browser engine, where React Native does not exist.',
	},
	[DomErrorCode.UnknownAction]: {
		fix: 'Check the name, and that the native side still passes the function prop.',
		what: 'A native action called from a DOM component rejects, naming the action.',
		why: 'The native actions are the function props the component is currently rendered with. That prop is missing, or was removed by a later render.',
	},
	[DomErrorCode.UnknownHandleMethod]: {
		fix: 'Add the method to the object `useDOMImperativeHandle` returns, and check the name.',
		what: "A call through a DOM component's `ref` rejects, naming the method.",
		why: 'A `ref` reaches only the methods the component exposes through `useDOMImperativeHandle`, as they were in its latest render.',
	},
	[DomErrorCode.MalformedMessage]: {
		fix: "Make sure no other code in the page posts to `window.ReactNativeWebView`. If nothing does, report the error with the app's and the library's versions.",
		what: "The native side or a DOM component reports a message it can't understand, or a page that started without its props.",
		why: 'The two sides exchange messages in a format of their own, over `window.ReactNativeWebView`. Something other than this library posted to it, or the page is not one the library built.',
	},
	[DomErrorCode.BridgeClosed]: {
		fix: "Expect calls to reject when a screen is dismissed, and ignore this code there. Use the hooks only in `'use dom'` modules, and open DOM components through their native proxy, not in a browser.",
		what: 'A call across the boundary rejects because the component went away, or a hook from `react-native-use-dom/dom` throws.',
		why: "A call can't complete once the DOM component unmounts or its WebView closes. The hooks only work while the native side renders the component in its WebView.",
	},
}

/** `docs/errors.md`, as {@link ERROR_DOCS} documents the codes. */
export function renderErrorsDoc(): string {
	const sections = Object.values(DomErrorCode).map((code) => {
		const { what, why, fix } = ERROR_DOCS[code]

		return `## \`${code}\`\n\n**What happens.** ${what}\n\n**Why.** ${why}\n\n**Fix.** ${fix}\n`
	})

	return [
		'# Errors\n',
		'Every error `react-native-use-dom` throws is a `DomError` with a stable `code`, which is safe to branch on. Messages may be reworded between versions; codes are not.\n',
		'<!-- Generated from packages/react-native-use-dom/src/docs/errors.ts by `pnpm docs:errors`. Edit that file instead. -->\n',
		...sections,
	].join('\n')
}
