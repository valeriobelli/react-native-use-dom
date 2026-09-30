import type { ConfigT } from 'metro-config';
import baseJSBundle from 'metro/private/DeltaBundler/Serializers/baseJSBundle';
import bundleToString from 'metro/private/lib/bundleToString';

import { buildPages } from './build-pages';
import type { BundleCommand } from './bundle-command';
import { resolveOutputDirectory } from './bundle-command';

type CustomSerializer = NonNullable<ConfigT['serializer']['customSerializer']>;
type SerializerArgs = Parameters<CustomSerializer>;
type Graph = SerializerArgs[2];

/** A `'use dom'` directive at the top of a module, after any comments. */
const USE_DOM_PROLOGUE = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use dom\1/u;

/** The DOM components a native bundle renders, in the order the graph holds them. */
export function findDomComponents(graph: Graph): string[] {
	const components: string[] = [];
	for (const [filePath, module] of graph.dependencies) {
		if (USE_DOM_PROLOGUE.test(module.getSource().toString('utf8'))) components.push(filePath);
	}
	return components;
}

/**
 * Wraps a native bundle's serializer so that a `bundle` run also builds the page of every DOM
 * component the bundle renders, and writes it where the app build packages it.
 *
 * The serializer is the one place Metro hands the finished graph to, which is what makes the list
 * of components exact: a component the app no longer imports is not built.
 *
 * @param upstream - The serializer the config already had, which still produces the native bundle.
 * @param resolveConfig - The project's config, as Metro resolves it for `projectRoot`, for the web build.
 * @param command - The output arguments of the `bundle` run.
 */
export function withReleaseBuild(
	upstream: CustomSerializer | null | undefined,
	resolveConfig: (projectRoot: string) => Promise<ConfigT>,
	command: BundleCommand,
): CustomSerializer {
	return async (...args) => {
		const [entryPoint, preModules, graph, options] = args;
		const components = findDomComponents(graph);
		if (components.length > 0) {
			const outputDirectory = resolveOutputDirectory(command, graph.transformOptions.platform ?? '');
			await buildPages(await resolveConfig(options.projectRoot), components, outputDirectory);
		}
		if (upstream) return upstream(...args);
		return bundleToString(baseJSBundle(entryPoint, preModules, graph, options)).code;
	};
}
