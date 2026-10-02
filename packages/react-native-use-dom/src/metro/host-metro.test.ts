import path from 'node:path'

import { findHostMetroPackage, hostMetro } from './host-metro'

// What identifies a server is the class that built it.
const ExpoServer = (): void => {}

const OwnServer = (): void => {}

const builtBy = (Class: () => void): object => ({ constructor: Class })

const EXPO_METRO = path.join('/app', 'node_modules', '.pnpm', 'metro@0.84.5', 'node_modules', 'metro')
const OWN_METRO = path.join('/app', 'node_modules', '.pnpm', 'metro@0.87.1', 'node_modules', 'metro')

const serverModule = (root: string): string => path.join(root, 'src', 'Server.js')

const cache = {
	[serverModule(EXPO_METRO)]: { exports: { default: ExpoServer } },
	[serverModule(OWN_METRO)]: { exports: { default: OwnServer } },
	[path.join(EXPO_METRO, 'src', 'HmrServer.js')]: { exports: {} },
}

it('picks the Metro whose Server built the dev server', () => {
	expect(findHostMetroPackage(cache, builtBy(ExpoServer))).toBe(path.join(EXPO_METRO, 'package.json'))
	expect(findHostMetroPackage(cache, builtBy(OwnServer))).toBe(path.join(OWN_METRO, 'package.json'))
})

it('picks the only Metro the process has loaded when there is no server', () => {
	const { [serverModule(OWN_METRO)]: _own, ...expoOnly } = cache

	expect(findHostMetroPackage(expoOnly)).toBe(path.join(EXPO_METRO, 'package.json'))
})

it('knows no host when several Metros are loaded, or the server comes from none of them', () => {
	expect(findHostMetroPackage(cache)).toBeUndefined()

	expect(
		findHostMetroPackage(
			cache,
			builtBy(() => {}),
		),
	).toBeUndefined()
})

it("falls back to this package's Metro", () => {
	expect(hostMetro().Server).toBe((require('metro/private/Server') as { default: unknown }).default)
})
