import { createHash } from 'node:crypto';

/**
 * The name of the page a release build embeds for the DOM component in `filePath`.
 *
 * The Babel plugin writes it into the native proxy and the release build writes the page under it,
 * so both derive it from the component's path alone. A digest rather than the path itself, so the
 * app bundle carries no trace of the machine it was built on.
 */
export function domBundleFileName(filePath: string): string {
	return `${createHash('md5').update(filePath).digest('hex')}.html`;
}
