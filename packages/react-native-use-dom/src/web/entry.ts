/**
 * The entry module of every DOM component bundle.
 *
 * Its body never runs: the bundler replaces it with a module that imports the requested
 * component and mounts it. It exists as a real file because a bundle entry has to be one.
 */
throw new Error(
	"react-native-use-dom: the DOM component entry was loaded without being generated. DOM bundles must be built by the bundler `withDom()` starts; check that metro.config.js wraps its config with `withDom` from 'react-native-use-dom/metro'.",
)
