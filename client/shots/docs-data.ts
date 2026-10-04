import { existsSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

const FIXTURE_OUT = fileURLToPath(new URL('../e2e/real/data/out', import.meta.url));

/** Where the docs server reads from, under the git-ignored data/ folder. */
export const DOCS_DATA_DIR = path.join(root, 'data', 'docs-shots');

/**
 * The data the docs pictures show: DOCS_DATA_DIR or DATA_DIR when set (a full import of the
 * archive, which shows the history and telemetry best), else the small committed fixture. The
 * folder is only ever read: the docs server gets a data directory of its own whose `out` is a
 * link to that one's `out`, so nothing the server writes can reach the original.
 */
export function prepareDocsData(): string {
	const source = process.env.DOCS_DATA_DIR || process.env.DATA_DIR;
	const out = source ? path.join(source, 'out') : FIXTURE_OUT;

	if (!existsSync(out)) {
		throw new Error(`No imported data at ${out}; unset DOCS_DATA_DIR or run the import first`);
	}

	mkdirSync(DOCS_DATA_DIR, { recursive: true });
	linkTo(out, path.join(DOCS_DATA_DIR, 'out'));

	return DOCS_DATA_DIR;
}

/** Playwright loads the config in every worker at once, so the link is only replaced when it points elsewhere. */
function linkTo(target: string, link: string): void {
	try {
		if (readlinkSync(link) === target) {
			return;
		}
	} catch {
		// No link yet.
	}

	rmSync(link, { force: true });

	try {
		symlinkSync(target, link, 'dir');
	} catch (error) {
		// Another worker made the same link first.
		if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
			throw error;
		}
	}
}
