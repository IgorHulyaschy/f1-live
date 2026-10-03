import { TAG_MAX, TAGS_MAX } from '@f1-live/shared/library';

import type { HandleCheck } from './library-api.ts';

/** Tags typed as a comma-separated line: trimmed, no blanks, no repeats (case aside), the first few. */
export function parseTags(line: string): string[] {
	const seen = new Set<string>();
	const tags: string[] = [];

	for (const part of line.split(',')) {
		const tag = part.trim().replaceAll(/\s+/g, ' ').slice(0, TAG_MAX).trim();
		const key = tag.toLowerCase();

		if (tag && !seen.has(key)) {
			seen.add(key);
			tags.push(tag);
		}
	}

	return tags.slice(0, TAGS_MAX);
}

/** Whether a tag line holds anything the server would refuse for its characters. */
export function tagLineProblem(line: string): string | null {
	return parseTags(line).some((tag) => !/^[\p{L}\p{N} -]+$/u.test(tag))
		? 'Tags can hold letters, numbers, spaces and hyphens'
		: null;
}

const HANDLE_PROBLEMS: Record<Exclude<HandleCheck, 'available'>, string> = {
	taken: 'Someone already has that handle',
	format: 'Use 3 to 20 lower-case letters, digits or underscores, starting with a letter',
	reserved: 'That name is kept for the team',
	profanity: 'Pick a name that is fine to put on a dashboard in front of everyone'
};

/** What to tell someone typing a handle; null while it is fine. */
export function handleProblem(check: HandleCheck): string | null {
	return check === 'available' ? null : HANDLE_PROBLEMS[check];
}
