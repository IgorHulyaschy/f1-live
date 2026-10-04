import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fails on a broken relative link, a missing image or heading anchor, an image without alt text,
 * a repository path in code that does not exist, and a picture under docs/ that no page shows. Covers README.md and every Markdown file in docs/.
 * External links are not fetched: this runs offline, in `npm run check`.
 */

export interface Link {
	file: string;
	line: number;
	target: string;
	image: boolean;
}

export interface Problem {
	file: string;
	line: number;
	message: string;
}

const PICTURES = /\.(png|jpe?g|gif|webp|svg)$/i;

function walk(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(directory, entry.name);

		return entry.isDirectory() ? walk(full) : [full];
	});
}

/** README.md plus everything under docs/, as paths relative to the repository root. */
export function documentsOf(root: string) {
	const docs = walk(path.join(root, 'docs')).map((file) => path.relative(root, file));

	return {
		pages: ['README.md', ...docs.filter((file) => file.endsWith('.md'))],
		pictures: docs.filter((file) => PICTURES.test(file))
	};
}

/** Markdown with fenced code blocks blanked out, line numbers kept. */
function unfenced(markdown: string): string[] {
	let fence: string | null = null;

	return markdown.split('\n').map((line) => {
		const opening = /^\s*(`{3,}|~{3,})/.exec(line);

		if (fence !== null) {
			// A fence closes on the same character, at least as many times as it opened.
			if (
				opening &&
				opening[1][0] === fence[0] &&
				line.trim() === opening[1] &&
				opening[1].length >= fence.length
			) {
				fence = null;
			}

			return '';
		}

		if (opening) {
			fence = opening[1];

			return '';
		}

		return line;
	});
}

/** Lines whose links count: no fenced code, and no inline code, which shows a link rather than making one. */
function prose(markdown: string): string[] {
	return unfenced(markdown).map((line) => line.replace(/`[^`]*`/g, ''));
}

const INLINE = /(!?)\[([^\]]*)\]\(\s*(<[^>]*>|[^\s)]*)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

const DEFINITION = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/;

const HTML = /<(img|a)\b[^>]*?\b(src|href)=["']([^"']*)["']/gi;

export function linksOf(file: string, markdown: string): Link[] {
	const links: Link[] = [];

	prose(markdown).forEach((text, index) => {
		const line = index + 1;

		for (const match of text.matchAll(INLINE)) {
			links.push({ file, line, target: match[3].replace(/^<|>$/g, ''), image: match[1] === '!' });
		}

		const definition = DEFINITION.exec(text);

		if (definition) {
			links.push({ file, line, target: definition[1].replace(/^<|>$/g, ''), image: false });
		}

		for (const match of text.matchAll(HTML)) {
			links.push({ file, line, target: match[3], image: match[1].toLowerCase() === 'img' });
		}
	});

	return links;
}

/** Image links with no alt text, which a screen reader would skip over. */
export function imagesWithoutAlt(markdown: string): number[] {
	const lines: number[] = [];

	prose(markdown).forEach((text, index) => {
		for (const match of text.matchAll(INLINE)) {
			if (match[1] === '!' && match[2].trim() === '') {
				lines.push(index + 1);
			}
		}
	});

	return lines;
}

/** GitHub's anchor for each heading: lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
export function anchorsOf(markdown: string): Set<string> {
	const anchors = new Set<string>();
	const seen = new Map<string, number>();

	for (const text of unfenced(markdown)) {
		const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(text);

		if (!heading) {
			continue;
		}

		const slug = heading[1]
			.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/`/g, '')
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\s_-]/gu, '')
			.trim()
			.replace(/\s/g, '-');

		const count = seen.get(slug) ?? 0;

		seen.set(slug, count + 1);
		anchors.add(count === 0 ? slug : `${slug}-${count}`);
	}

	return anchors;
}

function isFile(file: string): boolean {
	try {
		return statSync(file).isFile();
	} catch {
		return false;
	}
}

function exists(file: string): boolean {
	try {
		statSync(file);

		return true;
	} catch {
		return false;
	}
}

const REPOSITORY_PATH = /^(?:client|server|shared|docs|tools|deploy|\.github)\/[\w@./-]+$/;

/** Folders a run creates and git ignores; docs may name them. */
const GENERATED = ['client/shots/output', 'client/.lighthouseci'];

/** Repository paths written in code spans, such as `server/src/live/hub.ts`: each must exist. */
export function codePathsOf(markdown: string): { line: number; target: string }[] {
	return unfenced(markdown).flatMap((text, index) =>
		[...text.matchAll(/`([^`]+)`/g)].flatMap(([, span]) =>
			span !== undefined &&
			REPOSITORY_PATH.test(span) &&
			!GENERATED.some((folder) => span.startsWith(folder))
				? [{ line: index + 1, target: span }]
				: []
		)
	);
}

export function checkLinks(root: string): Problem[] {
	const { pages, pictures } = documentsOf(root);
	const problems: Problem[] = [];
	const shown = new Set<string>();
	const anchors = new Map<string, Set<string>>();

	function anchorsIn(file: string): Set<string> {
		const found = anchors.get(file) ?? anchorsOf(readFileSync(path.join(root, file), 'utf8'));

		anchors.set(file, found);

		return found;
	}

	for (const page of pages) {
		const markdown = readFileSync(path.join(root, page), 'utf8');

		for (const line of imagesWithoutAlt(markdown)) {
			problems.push({ file: page, line, message: 'image has no alt text' });
		}

		for (const { line, target } of codePathsOf(markdown)) {
			if (!exists(path.join(root, target))) {
				problems.push({ file: page, line, message: `\`${target}\` is not in the repository` });
			}
		}

		for (const link of linksOf(page, markdown)) {
			if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(link.target)) {
				continue;
			}

			const [pathPart, ...rest] = link.target.split('#');
			const fragment = rest.join('#');

			const resolved =
				pathPart === ''
					? page
					: path.normalize(
							pathPart.startsWith('/')
								? pathPart.slice(1)
								: path.join(path.dirname(page), decodeURIComponent(pathPart))
						);

			if (resolved.startsWith('..')) {
				problems.push({
					file: page,
					line: link.line,
					message: `${link.target} leaves the repository`
				});
			} else if (link.image && !isFile(path.join(root, resolved))) {
				problems.push({ file: page, line: link.line, message: `missing image ${link.target}` });
			} else if (!exists(path.join(root, resolved))) {
				problems.push({ file: page, line: link.line, message: `broken link ${link.target}` });
			} else {
				shown.add(resolved);

				if (fragment && resolved.endsWith('.md') && !anchorsIn(resolved).has(fragment)) {
					problems.push({
						file: page,
						line: link.line,
						message: `no heading #${fragment} in ${resolved}`
					});
				}
			}
		}
	}

	for (const picture of pictures) {
		if (!shown.has(picture)) {
			problems.push({ file: picture, line: 0, message: 'no page shows this picture' });
		}
	}

	return problems;
}

/** Pictures live in docs/ (made by `npm run docs:shots`) and the app's own icons in client/public. */
const PICTURE_HOMES = ['docs/', 'client/public/'];

/** Screenshot output piles up fast (446 files, 99 MB once), so a tracked PNG elsewhere is an error. */
export function strayPictures(tracked: string[]): Problem[] {
	return tracked.flatMap((file) =>
		file.endsWith('.png') && !PICTURE_HOMES.some((home) => file.startsWith(home))
			? [
					{
						file,
						line: 0,
						message:
							'a PNG outside docs/ and client/public/ is tracked; git rm --cached it and ignore its folder'
					}
				]
			: []
	);
}

function trackedPictures(root: string): string[] {
	return execFileSync('git', ['ls-files', '-z', '--', '*.png'], { cwd: root, encoding: 'utf8' })
		.split('\0')
		.filter(Boolean);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const root = fileURLToPath(new URL('../../', import.meta.url));
	const problems = [...checkLinks(root), ...strayPictures(trackedPictures(root))];

	for (const problem of problems) {
		console.error(`${problem.file}${problem.line ? `:${problem.line}` : ''}: ${problem.message}`);
	}

	if (problems.length > 0) {
		console.error(`\n${problems.length} documentation problem(s)`);
		process.exit(1);
	}

	process.stdout.write('Documentation links and pictures are all in place.\n');
}
