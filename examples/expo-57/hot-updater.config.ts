import { expo } from '@hot-updater/expo'
import { standaloneRepository } from '@hot-updater/standalone'
import { defineConfig } from 'hot-updater'

import { localStorage } from '../../scripts/ota/local-storage.mts'

// The test config needs no credentials: the server runs on loopback with clientAccess "public",
// and the admin token is the fixed test value. No .env.hotupdater is loaded or required.
const adminToken = process.env.HOT_UPDATER_ADMIN_TOKEN ?? 'test-admin'

export default defineConfig({
	build: expo(),
	database: standaloneRepository({
		baseUrl: 'http://localhost:3000/hot-updater/admin',
		commonHeaders: { Authorization: `Bearer ${adminToken}` },
	}),
	storage: localStorage({
		baseUrl: 'http://localhost:3000/storage',
		directory: '../../.hot-updater-data/storage',
	}),
	updateStrategy: 'appVersion',
})
