/**
 * The Metro integration, published as `react-native-use-dom/metro`.
 *
 * Wrap the config `metro.config.js` exports with {@link withDom}; nothing else in the project needs
 * to change for DOM components to build.
 */

export { withDom, type MetroConfigFunction, type MetroConfigInput } from './with-dom'
