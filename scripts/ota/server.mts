#!/usr/bin/env node

/**
 * A fully local Hot Updater server for the OTA end-to-end tests. Uses SQLite on disk for the
 * database, a local directory for storage, and `clientAccess: "public"` so the app needs no API
 * key. Run it with `node scripts/ota/server.mjs`; it listens on port 3000.
 *
 * Sources: https://hot-updater.dev/docs/custom/quick-start (Hono + Kysely + SQLite)
 * and https://hot-updater.dev/docs/storage-adapters/custom-storage (storage adapter contract).
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { serve } from '@hono/node-server'
import { createHotUpdater } from '@hot-updater/server'
import { kyselyAdapter } from '@hot-updater/server/adapters/kysely'
import Database from 'better-sqlite3'
import { Hono } from 'hono'
import { Kysely, SqliteDialect } from 'kysely'

import { localStorage } from './local-storage.mjs'

const root = path.resolve(import.meta.dirname, '..')
const dataDir = path.join(root, '.hot-updater-data')
const storageDir = path.join(dataDir, 'storage')

mkdirSync(dataDir, { recursive: true })
mkdirSync(storageDir, { recursive: true })

const db = new Kysely({
	dialect: new SqliteDialect({ database: new Database(path.join(dataDir, 'database.db')) }),
})

const PORT = Number(process.env['HOT_UPDATER_PORT'] ?? 3000)
const HOST = `http://localhost:${PORT}`

const hotUpdater = createHotUpdater({
	clientAccess: 'public',
	database: kyselyAdapter({ db, provider: 'sqlite' }),
	plugins: [],
	storage: localStorage({ baseUrl: `${HOST}/storage`, directory: storageDir }),
})

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

// oxlint-disable-next-line no-deprecated -- app.mount is deprecated in Hono v5; the server runs on v4.
app.mount('/hot-updater', hotUpdater.handlers.client)
// oxlint-disable-next-line no-deprecated -- app.mount is deprecated in Hono v5; the server runs on v4.
app.mount('/hot-updater/admin', hotUpdater.handlers.admin)

serve({ fetch: app.fetch, port: PORT })

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
