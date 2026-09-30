import type { NodePath, PluginObj, PluginPass, types as BabelTypes } from '@babel/core';

import { domBundleFileName } from '../metro/bundle-file';
import { DomError, DomErrorCode } from '../runtime/errors';

/** The directive that marks a module as a DOM component. */
export const USE_DOM_DIRECTIVE = 'use dom';

/** The module the generated proxy imports from. */
const RUNTIME_MODULE = 'react-native-use-dom';

/** The factory the generated proxy calls. */
const FACTORY = 'createDomComponentProxy';

export interface UseDomPluginOptions {
	/**
	 * Set to `'web'` to make the plugin inert, leaving the module to render as ordinary React.
	 * When omitted the plugin reads the platform from the Babel caller, which Metro supplies.
	 */
	platform?: string;
}

/** What the plugin records on `file.metadata` for the Metro layer to collect. */
export interface UseDomMetadata {
	/** Absolute path of the module carrying the directive. */
	filePath: string;
	/** Whether the module body was replaced with a proxy (native) or left alone (web). */
	erased: boolean;
}

interface State extends PluginPass {
	domMetadata?: UseDomMetadata;
}

/**
 * Turns a `'use dom'` module into a native proxy component.
 *
 * On a native platform the module's own body never reaches the native bundle: it is replaced with a
 * component that renders the DOM runtime and points it at this file. On web the plugin does
 * nothing, so the same file is an ordinary React component.
 *
 * @example
 * ```js
 * // babel.config.js
 * module.exports = { plugins: ['react-native-use-dom/babel'] };
 * ```
 */
export default function useDomPlugin(
	babel: { types: typeof BabelTypes },
	options: UseDomPluginOptions = {},
): PluginObj<State> {
	const t = babel.types;

	return {
		name: 'react-native-use-dom',
		visitor: {
			Program(path, state) {
				if (!hasUseDomDirective(path)) return;

				const filePath = state.file.opts.filename ?? '<unknown>';
				const platform = options.platform ?? readCallerPlatform(state);

				if (platform === 'web') {
					state.file.metadata = Object.assign(state.file.metadata as object, {
						useDom: { filePath, erased: false } satisfies UseDomMetadata,
					});
					return;
				}

				assertOnlyDefaultExport(path, filePath);

				path.node.directives = [];
				// Not skipped: the other plugins still visit the proxy, and leave it as the rest of the bundle.
				path.node.body = buildProxyModule(t, filePath);

				state.file.metadata = Object.assign(state.file.metadata as object, {
					useDom: { filePath, erased: true } satisfies UseDomMetadata,
				});
			},
		},
	};
}

function hasUseDomDirective(path: NodePath<BabelTypes.Program>): boolean {
	const [first] = path.node.directives;
	return first?.value.value === USE_DOM_DIRECTIVE;
}

function readCallerPlatform(state: State): string | undefined {
	const caller = (state.file.opts as { caller?: { platform?: unknown } }).caller;
	return typeof caller?.platform === 'string' ? caller.platform : undefined;
}

/**
 * A DOM module's only value export is its component: everything else would have to be reachable
 * from the native side, and nothing else can cross the boundary. Type exports are unaffected,
 * because they never exist at runtime.
 */
function assertOnlyDefaultExport(path: NodePath<BabelTypes.Program>, filePath: string): void {
	let hasDefault = false;

	for (const statement of path.node.body) {
		if (statement.type === 'ExportDefaultDeclaration') {
			hasDefault = true;
			continue;
		}

		if (statement.type === 'ExportAllDeclaration') {
			throw invalidExports(filePath, '`export *`');
		}

		if (statement.type === 'ExportNamedDeclaration' && !isTypeOnlyExport(statement)) {
			throw invalidExports(filePath, describeNamedExport(statement));
		}
	}

	if (!hasDefault) {
		throw new DomError(
			DomErrorCode.InvalidModuleExports,
			`${filePath} is marked '${USE_DOM_DIRECTIVE}' but has no default export.`,
			{ fix: 'A DOM component module must default-export the React component to render.' },
		);
	}
}

function isTypeOnlyExport(node: BabelTypes.ExportNamedDeclaration): boolean {
	if (node.exportKind === 'type') return true;
	const declaration = node.declaration;
	return (
		declaration?.type === 'TSTypeAliasDeclaration' ||
		declaration?.type === 'TSInterfaceDeclaration' ||
		declaration?.type === 'TSModuleDeclaration'
	);
}

function describeNamedExport(node: BabelTypes.ExportNamedDeclaration): string {
	const declaration = node.declaration;
	if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
		return `\`${declaration.id.name}\``;
	}
	if (declaration?.type === 'ClassDeclaration' && declaration.id) {
		return `\`${declaration.id.name}\``;
	}
	if (declaration?.type === 'VariableDeclaration') {
		const [first] = declaration.declarations;
		if (first?.id.type === 'Identifier') return `\`${first.id.name}\``;
	}
	const [specifier] = node.specifiers;
	if (specifier?.exported.type === 'Identifier') return `\`${specifier.exported.name}\``;
	return 'a named export';
}

function invalidExports(filePath: string, what: string): DomError {
	return new DomError(
		DomErrorCode.InvalidModuleExports,
		`${filePath} is marked '${USE_DOM_DIRECTIVE}' and exports ${what}, but a DOM component module may only export a default.`,
		{
			fix: 'Values other than the component cannot reach the native side. Move them into a separate module that both sides import.',
		},
	);
}

/**
 * Builds:
 * ```js
 * import { createDomComponentProxy } from 'react-native-use-dom';
 * export default createDomComponentProxy({ filePath: '<abs path>', bundleFile: '<page>.html' });
 * ```
 *
 * `bundleFile` names the page a release build embeds for this module. It is written on every
 * build, because the same native bundle can load from the dev server or from the app.
 */
function buildProxyModule(t: typeof BabelTypes, filePath: string): BabelTypes.Statement[] {
	const factory = t.identifier(FACTORY);

	return [
		t.importDeclaration([t.importSpecifier(factory, t.identifier(FACTORY))], t.stringLiteral(RUNTIME_MODULE)),
		t.exportDefaultDeclaration(
			t.callExpression(t.cloneNode(factory), [
				t.objectExpression([
					t.objectProperty(t.identifier('filePath'), t.stringLiteral(filePath)),
					t.objectProperty(t.identifier('bundleFile'), t.stringLiteral(domBundleFileName(filePath))),
				]),
			]),
		),
	];
}
