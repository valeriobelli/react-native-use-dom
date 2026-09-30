/**
 * Used by jest only. Consumer apps configure their own Babel; this library ships a plugin,
 * not a preset, so nothing here is published.
 */
module.exports = {
	presets: [
		['@babel/preset-env', { targets: { node: 'current' } }],
		'@babel/preset-typescript',
		['@babel/preset-react', { runtime: 'automatic' }],
	],
};
