import type { ConfigT } from 'metro-config'

import { buildPages } from './build-pages'
import type { BundleCommand } from './bundle-command'
import { resolveOutputDirectory } from './bundle-command'
import type { Metro } from './host-metro'
import { hostMetro } from './host-metro'

type CustomSerializer = NonNullable<ConfigT['serializer']['customSerializer']>
type SerializerArgs = Parameters<CustomSerializer>
type Graph = SerializerArgs[2]

/** A `'use dom'` directive at the top of a module, after any comments. */
const USE_DOM_PROLOGUE = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use dom\1/u

/** The DOM components a native bundle renders, in the order the graph holds them. */
export function findDomComponents(graph: Graph): string[] {
	const components: string[] = []

	for (const [filePath, module] of graph.dependencies) {
		if (USE_DOM_PROLOGUE.test(module.getSource().toString('utf8'))) {
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
		const components = findDomComponents(graph)

		if (components.length > 0) {
			const outputDirectory = resolveOutputDirectory(command, graph.transformOptions.platform ?? '')

			await buildPages(metro, await resolveConfig(metro, options.projectRoot), components, outputDirectory)
		}

		if (upstream) {
			return upstream(...args)
		}

		return metro.bundleToString(metro.baseJSBundle(entryPoint, preModules, graph, options)).code
	}
}
