import { existsSync } from 'node:fs'

import { bare } from '@hot-updater/bare'
import { standaloneRepository } from '@hot-updater/standalone'
import { defineConfig } from 'hot-updater'

import { localStorage } from '../../scripts/ota/local-storage.mjs'

if (existsSync('.env.hotupdater') === true) {
	process.loadEnvFile('.env.hotupdater')
}

const adminToken = process.env.HOT_UPDATER_ADMIN_TOKEN ?? 'test-admin'

export default defineConfig({
	build: bare({ enableHermes: true }),
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
