/**
 * The Hot Updater server configuration, shared by the server and the CLI's `db migrate` command.
 * Exports the `hotUpdater` instance so `npx hot-updater db migrate scripts/ota/hotUpdater.mts` can
 * create the database schema before the first run.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { createHotUpdater } from '@hot-updater/server'
import { kyselyAdapter } from '@hot-updater/server/adapters/kysely'
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import { localStorage } from './local-storage.mts'

const root = path.resolve(import.meta.dirname, '..', '..')
const dataDir = path.join(root, '.hot-updater-data')
const storageDir = path.join(dataDir, 'storage')

// SQLite cannot open a database whose parent directory is missing, and this module runs before
// server.mts creates any directory (imports are evaluated first).
mkdirSync(dataDir, { recursive: true })

const PORT = Number(process.env['HOT_UPDATER_PORT'] ?? 3000)
const HOST = `http://localhost:${PORT}`

const db = new Kysely({
	dialect: new SqliteDialect({ database: new Database(path.join(dataDir, 'database.db')) }),
})

export const hotUpdater = createHotUpdater({
	clientAccess: 'public',
	database: kyselyAdapter({ db, provider: 'sqlite' }),
	plugins: [],
	storage: localStorage({ baseUrl: `${HOST}/storage`, directory: storageDir }),
})
