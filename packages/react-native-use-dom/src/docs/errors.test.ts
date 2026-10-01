import fs from 'node:fs';
import path from 'node:path';

import { DomErrorCode } from '../runtime/errors';
import { ERROR_DOCS, renderErrorsDoc } from './errors';

const ERRORS_DOC = path.join(__dirname, '..', '..', '..', '..', 'docs', 'errors.md');

// `pnpm docs:errors` sets it, to write the document instead of comparing it.
if (process.env['WRITE_ERRORS_DOC'] === '1') fs.writeFileSync(ERRORS_DOC, renderErrorsDoc());

it('documents every error code with what happens, why and the fix', () => {
	for (const code of Object.values(DomErrorCode)) {
		const { what, why, fix } = ERROR_DOCS[code];
		expect([code, what, why, fix].every((text) => text.trim() !== '')).toBe(true);
	}
	expect(Object.keys(ERROR_DOCS).sort()).toStrictEqual(Object.values(DomErrorCode).sort());
});

it('matches docs/errors.md, which `pnpm docs:errors` writes', () => {
	expect(fs.readFileSync(ERRORS_DOC, 'utf8')).toBe(renderErrorsDoc());
});
