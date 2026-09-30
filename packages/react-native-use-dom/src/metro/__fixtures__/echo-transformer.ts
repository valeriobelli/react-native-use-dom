import type { BabelTransformer, BabelTransformerArgs } from 'metro-babel-transformer';

/** Every call the web transformer forwarded, for tests to inspect. */
export const calls: BabelTransformerArgs[] = [];

export const transform: BabelTransformer['transform'] = (args) => {
	calls.push(args);
	return { ast: null as never };
};

export function getCacheKey(): string {
	return 'echo-key';
}
