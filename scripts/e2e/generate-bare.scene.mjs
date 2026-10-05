/**
 * The scene life cycle of the bare examples. An app built with the iOS 27 SDK does not launch without
 * it, and React Native's template ships a `SceneDelegate.swift` only from 0.88. The generator adds
 * one to the templates that lack it, reproducing the change `examples/bare-0.87` carries. The edits
 * to the Xcode project are made by `addToProject`, which the command line runs through the
 * `xcodeproj` gem, so the tests can run without Ruby.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Adds a file to an Xcode project's target.
 *
 * @typedef {(project: string, target: string) => void} AddToProject
 */

/** The file a template that supports scenes ships, and that the patch adds to the others. */
export const SCENE_DELEGATE = 'SceneDelegate.swift'

/** The `AppDelegate.swift` of a scene-based app: it only hands the launch over to the scene. */
export const APP_DELEGATE = `import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    true
  }
}
`

/**
 * The `SceneDelegate.swift` that starts React Native in the scene's window.
 *
 * @param {string} appName the name the app registers its root component under
 * @returns {string}
 */
export function sceneDelegate(appName) {
	return `import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit

class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)

    // This React Native has no scene-aware start API yet, so the scene carries no launch options.
    reactNativeFactory?.startReactNative(
      withModuleName: "${appName}",
      in: window,
      launchOptions: nil
    )
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
`
}

/** The `UIApplicationSceneManifest` entry of an `Info.plist`, indented the way the template indents it. */
const SCENE_MANIFEST = `	<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
		<false/>
		<key>UISceneConfigurations</key>
		<dict>
			<key>UIWindowSceneSessionRoleApplication</key>
			<array>
				<dict>
					<key>UISceneConfigurationName</key>
					<string>Default Configuration</string>
					<key>UISceneDelegateClassName</key>
					<string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
				</dict>
			</array>
		</dict>
	</dict>
`

/** The key after which the manifest goes, which keeps the keys of the plist in alphabetical order. */
const MANIFEST_BEFORE = '\t<key>UILaunchStoryboardName</key>\n'

/**
 * Adds the scene manifest to an `Info.plist`, unless it has one.
 *
 * @param {string} plist
 * @returns {string}
 */
export function addSceneManifest(plist) {
	if (plist.includes('UIApplicationSceneManifest')) {
		return plist
	}

	if (!plist.includes(MANIFEST_BEFORE)) {
		throw new Error('the Info.plist has no UILaunchStoryboardName key to put the scene manifest before')
	}

	return plist.replace(MANIFEST_BEFORE, `${SCENE_MANIFEST}${MANIFEST_BEFORE}`)
}

/**
 * Gives a bare example the scene life cycle, when its template lacks it.
 *
 * @param {object} options
 * @param {string} options.root the repository root
 * @param {{ appName: string, folder: string }} options.cell
 * @param {AddToProject} options.addToProject adds `SceneDelegate.swift` to the Xcode project's target
 * @returns {boolean} whether the example changed: it does not when the folder has no iOS project yet
 */
export function applySceneLifeCycle({ addToProject, cell, root }) {
	const ios = path.join(root, cell.folder, 'ios')
	const app = path.join(ios, cell.appName)

	if (!existsSync(app) || existsSync(path.join(app, SCENE_DELEGATE))) {
		return false
	}

	writeFileSync(path.join(app, SCENE_DELEGATE), sceneDelegate(cell.appName))
	writeFileSync(path.join(app, 'AppDelegate.swift'), APP_DELEGATE)

	const plist = path.join(app, 'Info.plist')

	writeFileSync(plist, addSceneManifest(readFileSync(plist, 'utf8')))
	addToProject(path.join(ios, `${cell.appName}.xcodeproj`), cell.appName)

	return true
}
