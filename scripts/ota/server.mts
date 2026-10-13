#!/usr/bin/env node

/**
 * A fully local Hot Updater server for the OTA end-to-end tests. Uses SQLite on disk for the
 * database, a local directory for storage, and `clientAccess: "public"` so the app needs no API
 * key. Run it with `node scripts/ota/server.mts`; it listens on port 3000.
 *
 * Sources: https://hot-updater.dev/docs/custom/quick-start (Hono + Kysely + SQLite)
 * and https://hot-updater.dev/docs/storage-adapters/custom-storage (storage adapter contract).
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { hotUpdater } from './hotUpdater.mts'

const root = path.resolve(import.meta.dirname, '..', '..')
const storageDir = path.join(root, '.hot-updater-data', 'storage')

mkdirSync(storageDir, { recursive: true })

const PORT = Number(process.env['HOT_UPDATER_PORT'] ?? 3000)

const app = new Hono()

// Serve stored files for downloads. The storage adapter's getDownloadUrl returns URLs here.
app.get('/storage/*', (c) => {
	const key = c.req.path.replace('/storage/', '')
	const file = path.join(storageDir, key)

	if (!existsSync(file) || !statSync(file).isFile()) {
		return c.notFound()
	}

	return c.body(readFileSync(file), 200, { 'cache-control': 'no-cache', 'content-type': guessMime(key) })
})

// The admin handler is mounted before the client handler: the client mount at `/hot-updater` also
// matches `/hot-updater/admin/*`, so the more specific path has to win by being registered first,
// or the deploy CLI cannot reach the admin API.
// oxlint-disable-next-line no-deprecated -- app.mount is deprecated in Hono v5; the server runs on v4.
app.mount('/hot-updater/admin', hotUpdater.handlers.admin)
// oxlint-disable-next-line no-deprecated -- app.mount is deprecated in Hono v5; the server runs on v4.
app.mount('/hot-updater', hotUpdater.handlers.client)

// The server has no authentication and must never leave the machine: only loopback. The iOS
// simulator reaches it through localhost, and the Android emulator through `adb reverse`.
serve({ fetch: app.fetch, hostname: '[IP_ADDRESS]', port: PORT })

function guessMime(key: string): string {
	const ext = path.extname(key).slice(1).toLowerCase()

	const types: Record<string, string> = {
		css: 'text/css',
		html: 'text/html',
		js: 'text/javascript',
		json: 'application/json',
		mjs: 'text/javascript',
		png: 'image/png',
		svg: 'image/svg+xml',
		wasm: 'application/wasm',
	}

	return types[ext] ?? 'application/octet-stream'
}
