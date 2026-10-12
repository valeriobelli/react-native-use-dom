/**
 * Finds the bare examples whose `ios/Podfile.lock` was written for another React Native version than
 * the one their `package.json` pins, which is what a matrix update that bumps a cell leaves behind.
 * `pod install` refuses such a lock, because the version of its local podspecs changed, so the pods
 * that come from a local path are updated instead, and the pods from the CDN keep their versions:
 * https://guides.cocoapods.org/using/pod-install-vs-update.html
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { readBareFolders } from './generate-bare.mts'

/** React Native's own pod, whose version is the React Native version the lock was written for. */
const REACT_CORE = /^ {2}- React-Core \(([^)]+)\)/mu

/** A top-level key of a `Podfile.lock`, such as `EXTERNAL SOURCES:`. */
const SECTION = /^\S/u

/** A pod under `EXTERNAL SOURCES`: indented once, and quoted when its name needs it. */
const EXTERNAL_POD = /^ {2}"?([^":\s]+)"?:$/u

/**
 * Reads the React Native version a `Podfile.lock` was written for.
 *
 * @param options `lock` holds the contents of the `Podfile.lock`
 * @returns the version of `React-Core`, or `null` when the lock has none
 */
export function lockedReactNative({ lock }: { lock: string }): string | null {
	return REACT_CORE.exec(lock)?.[1] ?? null
}

/**
 * Lists the pods a `Podfile.lock` takes from a local path or podspec: React Native's, which a bump
 * changes, and the libraries', which the workspace links.
 *
 * @param options `lock` holds the contents of the `Podfile.lock`
 */
export function localPods({ lock }: { lock: string }): string[] {
	const lines = lock.split('\n')
	const start = lines.indexOf('EXTERNAL SOURCES:') + 1

	if (!start) {
		return []
	}

	const end = lines.findIndex((line, index) => index >= start && SECTION.test(line))
	const section = lines.slice(start, end === -1 ? lines.length : end)

	return section.flatMap((line) => {
		const match = EXTERNAL_POD.exec(line)

		return match ? [match[1]!] : []
	})
}

/**
 * A bare example whose pods were installed for another React Native version.
 */
export interface StaleFolder {
	/** The folder, relative to the repository root, such as `examples/bare-0.88`. */
	folder: string
	/** The React Native version of its `Podfile.lock`. */
	locked: string
	/** The React Native version of its `package.json`. */
	pinned: string
	/** The pods to update. */
	pods: string[]
}

/**
 * Finds the bare examples whose `Podfile.lock` doesn't match the React Native version they pin. A
 * folder without a lock is left out: it is a new example, whose pods need `pod install`.
 *
 * @param options `root` is the repository root
 */
export function staleBareFolders({ root }: { root: string }): StaleFolder[] {
	const folders = [...readBareFolders(root)].sort(([left], [right]) => left.localeCompare(right, 'en'))

	return folders.flatMap(([name, pinned]) => {
		const folder = path.posix.join('examples', name)
		const lock = readLock({ file: path.join(root, folder, 'ios', 'Podfile.lock') })
		const locked = lockedReactNative({ lock })

		return pinned && locked && locked !== pinned ? [{ folder, locked, pinned, pods: localPods({ lock }) }] : []
	})
}

/**
 * @param options `file` is the path of the lock to read
 * @returns the lock, or an empty one when the file is missing, which names no version
 */
function readLock({ file }: { file: string }): string {
	try {
		return readFileSync(file, 'utf8')
	} catch {
		return ''
	}
}

/**
 * Updates the local pods of each stale bare example, and returns the folders it updated.
 *
 * @param options `root` is the repository root, `podUpdate` runs
 * `pod update --no-repo-update` for the pods, in the example's `ios` folder, and `log` reports
 * the updates
 */
export function updateStalePods({
	log = () => {},
	podUpdate,
	root,
}: {
	log?: (message: string) => void
	podUpdate: (options: { folder: string; pods: string[] }) => void
	root: string
}): string[] {
	const stale = staleBareFolders({ root })

	for (const { folder, locked, pinned, pods } of stale) {
		log(`updating the pods of ${folder} from react-native ${locked} to ${pinned}`)
		podUpdate({ folder, pods })
	}

	return stale.map(({ folder }) => folder)
}
