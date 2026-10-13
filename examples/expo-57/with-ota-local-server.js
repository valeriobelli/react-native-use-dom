const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins')
const fs = require('node:fs')
const path = require('node:path')

const networkSecurityConfig = ({ body }) =>
	[
		'<?xml version="1.0" encoding="utf-8"?>',
		'<network-security-config>',
		...body,
		'</network-security-config>',
		'',
	].join('\n')

/**
 * Lets the app reach the local Hot Updater server over cleartext `http://localhost`, the way the
 * bare OTA hosts do through their network security config. Only localhost is permitted, and the
 * server binds the loopback interface, so nothing else becomes reachable in cleartext.
 *
 * The XML file is written at prebuild time, and the manifest points at it. A network security
 * config makes Android ignore `usesCleartextTraffic`, so the debug variant gets its own copy that
 * permits cleartext everywhere: a debug build loads its bundle from Metro over cleartext.
 */
const withOtaLocalServer = (config) => {
	config = withDangerousMod(config, [
		'android',
		(mod) => {
			const variants = {
				debug: ['    <base-config cleartextTrafficPermitted="true" />'],
				main: [
					'    <domain-config cleartextTrafficPermitted="true">',
					'        <domain includeSubdomains="false">localhost</domain>',
					'    </domain-config>',
				],
			}

			for (const [variant, body] of Object.entries(variants)) {
				const xmlDir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', variant, 'res', 'xml')

				fs.mkdirSync(xmlDir, { recursive: true })
				fs.writeFileSync(path.join(xmlDir, 'ota_local_server.xml'), networkSecurityConfig({ body }))
			}

			return mod
		},
	])

	config = withAndroidManifest(config, (mod) => {
		const application = mod.modResults.manifest.application?.[0]

		if (application) {
			application.$['android:networkSecurityConfig'] = '@xml/ota_local_server'
		}

		return mod
	})

	return config
}

module.exports = withOtaLocalServer
