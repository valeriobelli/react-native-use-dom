/**
 * A local storage adapter for Hot Updater that keeps files in a directory on disk. Both the CLI
 * (during deploy) and the server (at runtime) use it: the CLI writes files to the directory, and
 * the server reads them and resolves download URLs to the HTTP route that serves the directory.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { createStorageAdapter, createStorageUri, parseStorageUri } from '@hot-updater/plugin-core'

/** The protocol every stored URI uses, so the CLI and the server agree on the same scheme. */
const PROTOCOL = 'local'

export interface LocalStorageOptions {
	/** The directory the files are stored in. */
	directory: string
	/** The HTTP base URL the server serves the directory at, without a trailing slash. */
	baseUrl: string
}

// the adapter returns one object literal
// oxlint-disable-next-line max-lines-per-function
export const localStorage = ({ directory, baseUrl }: LocalStorageOptions) => {
	mkdirSync(directory, { recursive: true })

	const keyOf = ({ storageUri }: { storageUri: string }) => parseStorageUri(storageUri, PROTOCOL).key
	const filePath = ({ key }: { key: string }) => path.join(directory, key)

	return createStorageAdapter({
		delete({ storageUri }) {
			rmSync(filePath({ key: keyOf({ storageUri }) }), { force: true })

			return Promise.resolve({ deleted: true as const })
		},
		exists({ storageUri }) {
			return Promise.resolve({ exists: existsSync(filePath({ key: keyOf({ storageUri }) })) })
		},
		get({ storageUri }) {
			const key = keyOf({ storageUri })
			const file = filePath({ key })

			if (!existsSync(file)) {
				return Promise.resolve({ response: null })
			}

			const stat = statSync(file)

			return Promise.resolve({
				response: new Response(readFileSync(file), {
					headers: {
						'content-length': String(stat.size),
						'content-type': 'application/octet-stream',
					},
				}),
			})
		},
		getDownloadUrl({ storageUri }) {
			return Promise.resolve({ url: `${baseUrl}/${keyOf({ storageUri })}` })
		},
		name: 'localStorage',
		protocol: PROTOCOL,
		async put({ body, key }) {
			const file = filePath({ key })

			mkdirSync(path.dirname(file), { recursive: true })

			const bytes = await new Response(body).arrayBuffer()

			writeFileSync(file, Buffer.from(bytes))

			return { storageUri: createStorageUri({ bucket: 'local', key, protocol: PROTOCOL }) }
		},
	})
}
