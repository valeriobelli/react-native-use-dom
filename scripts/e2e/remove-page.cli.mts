#!/usr/bin/env node

/**
 * Removes the `Missing` page from a built app's `dom.bundle` folder:
 * `node scripts/e2e/remove-page.cli.mts <dom.bundle directory>`. The `page-not-found` release flow
 * then renders that component against a build whose page is not next to the running bundle.
 */

import { removePageByMarker } from './remove-page.mts'

const [bundleDirectory] = process.argv.slice(2)

if (bundleDirectory === undefined) {
	process.stderr.write('usage: node scripts/e2e/remove-page.cli.mts <dom.bundle directory>\n')
	process.exit(2)
}

try {
	const page = removePageByMarker(bundleDirectory)

	process.stdout.write(`removed ${page} from ${bundleDirectory}\n`)
} catch (failure) {
	process.stderr.write(`${failure instanceof Error ? failure.message : String(failure)}\n`)
	process.exit(1)
}
