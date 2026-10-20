import type { ConfigT } from 'metro-config'

import { buildPages } from './build-pages'
import type { BundleCommand } from './bundle-command'
import { resolveOutputDirectory } from './bundle-command'
import { domBundleFileName } from './bundle-file'
import type { Metro } from './host-metro'
import { hostMetro } from './host-metro'

type CustomSerializer = NonNullable<ConfigT['serializer']['customSerializer']>
type SerializerArgs = Parameters<CustomSerializer>
type Graph = SerializerArgs[2]

/**
 * The DOM components a native bundle renders, in the order the graph holds them.
 *
 * Reads the code Metro already holds for each module rather than the source on disk: `getSource()`
 * reads the file again, assets included. The Babel plugin replaces a `'use dom'` module with a call
 * that names its page, `domBundleFileName(filePath)`, as a string literal. Neither a module that
 * imports the component, nor the library's own proxy factory, contains that name, and a minifier
 * keeps string literals.
 */
function findDomComponents({ graph }: { graph: Graph }): string[] {
	const components: string[] = []

	for (const [filePath, module] of graph.dependencies) {
		const bundleFile = domBundleFileName(filePath)

		const isProxy = module.output.some(
			({ data, type }) => type === 'js/module' && (data as { code?: string }).code?.includes(bundleFile),
		)

		if (isProxy) {
			components.push(filePath)
		}
	}

	return components
}

/**
 * Wraps a native bundle's serializer so that a `bundle` run also builds the page of every DOM
 * component the bundle renders, and writes it where the app build packages it.
 *
 * The serializer is the one place Metro hands the finished graph to, which is what makes the list
 * of components exact: a component the app no longer imports is not built.
 *
 * @param upstream - The serializer the config already had, which still produces the native bundle.
 * @param resolveConfig - The project's config, as `metro` resolves it for `projectRoot`, for the web build.
 * @param command - The output arguments of the `bundle` run.
 */
export function withReleaseBuild(
	upstream: CustomSerializer | null | undefined,
	resolveConfig: (metro: Metro, projectRoot: string) => Promise<ConfigT>,
	command: BundleCommand,
): CustomSerializer {
	return async (...args) => {
		const [entryPoint, preModules, graph, options] = args
		// Serializing, the bundler has loaded its Metro; the web build is made with the same one.
		const metro = hostMetro()
		const components = findDomComponents({ graph })

		if (components.length > 0) {
			const outputDirectory = resolveOutputDirectory(command, graph.transformOptions.platform ?? '')

			await buildPages({
				components,
				config: await resolveConfig(metro, options.projectRoot),
				metro,
				outputDirectory,
			})
		}

		if (upstream) {
			return upstream(...args)
		}

		return metro.bundleToString(metro.baseJSBundle(entryPoint, preModules, graph, options)).code
	}
}
