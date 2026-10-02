import { createReadStream } from 'node:fs'
import { cp, stat } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import path from 'node:path'

/** The folder of the project, next to its Metro config, whose files DOM component pages can load. */
export const PUBLIC_DIRECTORY = 'public'

/** Content types by extension, for the files a page loads; anything else is served as bytes. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
	'.avif': 'image/avif',
	'.css': 'text/css; charset=UTF-8',
	'.gif': 'image/gif',
	'.htm': 'text/html; charset=UTF-8',
	'.html': 'text/html; charset=UTF-8',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript; charset=UTF-8',
	'.json': 'application/json; charset=UTF-8',
	'.mjs': 'text/javascript; charset=UTF-8',
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.otf': 'font/otf',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ttf': 'font/ttf',
	'.txt': 'text/plain; charset=UTF-8',
	'.wasm': 'application/wasm',
	'.wav': 'audio/wav',
	'.webm': 'video/webm',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.xml': 'application/xml; charset=UTF-8',
}

/** The public folder of the project `projectRoot` is the root of. */
export function publicDirectory(projectRoot: string): string {
	return path.join(projectRoot, PUBLIC_DIRECTORY)
}

/**
 * Answers with the file of `directory` at `relativeUrl`, a URL path relative to the folder.
 * Resolves `false`, having answered nothing, when there is no such file or the path leads out of
 * the folder.
 */
export async function sendPublicFile(directory: string, relativeUrl: string, res: ServerResponse): Promise<boolean> {
	const file = resolveInside(directory, relativeUrl)

	if (file === undefined || !(await isFile(file))) {
		return false
	}

	res.writeHead(200, {
		'Cache-Control': 'no-cache',
		'Content-Type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
	})

	await new Promise<void>((resolve, reject) => {
		createReadStream(file).on('error', reject).on('end', resolve).pipe(res)
	})

	return true
}

/** Copies `directory`, when the project has one, into `outputDirectory`. */
export async function copyPublicDirectory(directory: string, outputDirectory: string): Promise<void> {
	if (!(await isDirectory(directory))) {
		return
	}

	await cp(directory, outputDirectory, { recursive: true })
}

function resolveInside(directory: string, relativeUrl: string): string | undefined {
	let decoded: string

	try {
		decoded = decodeURIComponent(relativeUrl)
	} catch {
		return undefined
	}

	if (decoded.includes('\0')) {
		return undefined
	}

	const file = path.resolve(directory, `.${path.posix.sep}${decoded}`)

	return file.startsWith(`${directory}${path.sep}`) ? file : undefined
}

async function isFile(file: string): Promise<boolean> {
	return (await stat(file).catch(() => null))?.isFile() ?? false
}

async function isDirectory(directory: string): Promise<boolean> {
	return (await stat(directory).catch(() => null))?.isDirectory() ?? false
}
