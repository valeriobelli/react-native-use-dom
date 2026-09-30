import path from 'node:path';

import { DomError, DomErrorCode } from '../runtime/errors';
import { OFFLINE_BUNDLE_DIR } from '../runtime/paths';

/** The arguments of a `react-native bundle` run that decide where its output goes. */
export interface BundleCommand {
	bundleOutput: string;
	assetsDest: string | undefined;
}

/**
 * Reads the output arguments of the `bundle` command this process runs, or `null` when it runs
 * something else, such as the dev server. React Native gives a Metro config no other way to tell a
 * build that ends up in the app from one that is served: both run the same serializer.
 */
export function readBundleCommand(argv: readonly string[]): BundleCommand | null {
	const bundleOutput = readArgument(argv, '--bundle-output');
	if (bundleOutput === undefined) return null;
	return { bundleOutput, assetsDest: readArgument(argv, '--assets-dest') };
}

function readArgument(argv: readonly string[], name: string): string | undefined {
	for (const [index, argument] of argv.entries()) {
		if (argument === name) return argv[index + 1];
		if (argument.startsWith(`${name}=`)) return argument.slice(name.length + 1);
	}
	return undefined;
}

/**
 * The folder the pages go in, which the app build packages with the rest of the bundle's output.
 *
 * On Android, `--assets-dest` is the resources folder and the bundle itself is written among the
 * assets, so the pages go next to the bundle. On iOS, the bundle is copied into the app from where
 * it is written, while `--assets-dest` is the app's resources folder itself.
 */
export function resolveOutputDirectory(command: BundleCommand, platform: string): string {
	if (platform === 'android') {
		return path.join(path.dirname(path.resolve(command.bundleOutput)), OFFLINE_BUNDLE_DIR);
	}
	if (command.assetsDest === undefined) {
		throw new DomError(
			DomErrorCode.MissingBundleOutput,
			`The ${platform} bundle has DOM components, but no --assets-dest was given to write their pages to.`,
			{
				fix: "Pass --assets-dest with the folder the app's resources are copied from. Xcode's “Bundle React Native code and images” build phase passes it already.",
			},
		);
	}
	return path.join(path.resolve(command.assetsDest), OFFLINE_BUNDLE_DIR);
}
