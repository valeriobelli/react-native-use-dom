import path from 'node:path'

import type { CustomResolutionContext, Resolution } from 'metro-resolver'

import { DomError, DomErrorCode } from '../runtime/errors'

/** The file every DOM component bundle is requested with as its entry. */
export const WEB_ENTRY_PATH = require.resolve('../web/entry')

/**
 * What the entry imports the requested component as. It is never a file: the web resolver answers it
 * with the component of the build, so the entry's own transform is the same for every component.
 */
export const DOM_COMPONENT_SPECIFIER = 'react-native-use-dom/internal/dom-component'

/**
 * The key, set from the `resolver.dom` bundle URL parameter, naming the component to build.
 *
 * It travels as a resolver option, not a transform option: Metro keys the transform cache of every
 * file on the transform options, so a component named there would have each module that components
 * share transformed once per component.
 */
export const DOM_RESOLVER_OPTION = 'dom'

/**
 * The transform option Expo's own CLI sets on every DOM component build, with the same value for all of them.
 *
 * Expo's Babel transformer and `babel-preset-expo` read it to select the WebView preset, which
 * compiles for the Android WebView (`@expo/metro-config` `babel-transformer.js:92`, `babel-preset-expo`
 * `build/index.js:36-72`). The value never names a component, so it adds nothing to the transform cache key
 * that differs between components.
 */
export const DOM_TRANSFORM_OPTIONS = { dom: 'true' } as const

/**
 * Resolves the entry's import of {@link DOM_COMPONENT_SPECIFIER} to the component the build names.
 *
 * The component path arrives in a URL anyone who can reach the dev server can craft, so it is only
 * honoured for files Metro would serve anyway: the project, its watch folders and its server root.
 * Resolution runs before anything is transformed or served, so a file outside them is never built.
 *
 * @param allowedRoots - The directories a DOM component may be built from.
 */
export function resolveDomComponent({
	allowedRoots,
	context,
}: {
	allowedRoots: readonly string[]
	context: CustomResolutionContext
}): Resolution {
	const requested = context.customResolverOptions[DOM_RESOLVER_OPTION]

	if (typeof requested !== 'string' || !path.isAbsolute(requested)) {
		throw new DomError(
			DomErrorCode.UnknownDomComponent,
			'A DOM component bundle was requested without naming its component.',
			{
				fix: 'DOM component pages are requested by the native view with the absolute path of the component. Load them through a DOM component rather than by URL.',
			},
		)
	}

	const componentPath = path.normalize(requested)

	if (!allowedRoots.some((root) => isInside({ filePath: componentPath, root }))) {
		throw new DomError(
			DomErrorCode.UnknownDomComponent,
			`${componentPath} was requested as a DOM component, but it is outside the project, its watch folders and Metro's server root.`,
			{
				fix: 'Only files Metro serves can be DOM components. Move the component into the project, or add its directory to `watchFolders` in metro.config.js.',
			},
		)
	}

	return { filePath: componentPath, type: 'sourceFile' }
}

/** Whether the entry's import of the component is the one `moduleName` asks for. */
export function isDomComponentImport({
	context,
	moduleName,
}: {
	context: CustomResolutionContext
	moduleName: string
}): boolean {
	return moduleName === DOM_COMPONENT_SPECIFIER && context.originModulePath === WEB_ENTRY_PATH
}

function isInside({ filePath, root }: { filePath: string; root: string }): boolean {
	const relative = path.relative(root, filePath)

	return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}
