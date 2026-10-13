const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins')
const fs = require('node:fs')
const path = require('node:path')

/**
 * Lets the app reach the local Hot Updater server over cleartext `http://localhost`, the way the
 * bare OTA hosts do through their network security config. Only localhost is permitted, and the
 * server binds the loopback interface, so nothing else becomes reachable in cleartext.
 *
 * The XML file is written at prebuild time, and the manifest points at it.
 */
const withOtaLocalServer = (config) => {
	config = withDangerousMod(config, [
		'android',
		(mod) => {
			const xmlDir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml')

			fs.mkdirSync(xmlDir, { recursive: true })

			fs.writeFileSync(
				path.join(xmlDir, 'ota_local_server.xml'),
				[
					'<?xml version="1.0" encoding="utf-8"?>',
					'<network-security-config>',
					'    <domain-config cleartextTrafficPermitted="true">',
					'        <domain includeSubdomains="false">localhost</domain>',
					'    </domain-config>',
					'</network-security-config>',
					'',
				].join('\n'),
			)

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
