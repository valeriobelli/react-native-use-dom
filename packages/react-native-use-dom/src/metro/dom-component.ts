import path from 'node:path'

import type { CustomResolutionContext } from 'metro-resolver'

import { DomError, DomErrorCode } from '../runtime/errors'
import { DOM_RESOLVER_OPTION, DOM_TRANSFORM_OPTIONS, WEB_PLATFORM } from '../runtime/paths'

/** The file every DOM component bundle is requested with as its entry. */
export const WEB_ENTRY_PATH = require.resolve('../web/entry')

/**
 * What the entry imports the requested component as. It is never a file: the web resolver answers it
 * with the component of the build, so the entry's own transform is the same for every component.
 */
export const DOM_COMPONENT_SPECIFIER = 'react-native-use-dom/internal/dom-component'

/**
 * The build options that make {@link WEB_ENTRY_PATH} the bundle of `component`.
 *
 * The component is named to the resolver, not to the transformer: a transform option is part of the
 * cache key of every module, so each module the pages share would be transformed once per page.
 */
export function domBundleOptions({ component }: { component: string }): {
	customResolverOptions: Record<string, string>
	customTransformOptions: Record<string, string>
	platform: string
} {
	return {
		customResolverOptions: { [DOM_RESOLVER_OPTION]: component },
		customTransformOptions: DOM_TRANSFORM_OPTIONS,
		platform: WEB_PLATFORM,
	}
}

/**
 * The path of the component the build names, which the entry's import of
 * {@link DOM_COMPONENT_SPECIFIER} is resolved as.
 *
 * The component path arrives in a URL anyone who can reach the dev server can craft, so it is only
 * honoured for files Metro would serve anyway: the project, its watch folders and its server root.
 * Resolution runs before anything is transformed or served, so a file outside them is never built.
 *
 * @param allowedRoots - The directories a DOM component may be built from.
 */
export function domComponentPath({
	allowedRoots,
	context,
}: {
	allowedRoots: readonly string[]
	context: CustomResolutionContext
}): string {
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

	return componentPath
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
