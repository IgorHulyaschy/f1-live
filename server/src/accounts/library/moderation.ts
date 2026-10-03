import { HANDLE_PATTERN, normalizeHandle } from '@f1-live/shared/library';

/**
 * The library's house rules for what a fan may call themselves and their work. The lists here
 * are the default policy; the owner extends them through the environment (accounts/config.ts).
 * Handles are matched hard (a blocked word anywhere inside), free text by whole word, so a
 * place name that contains a short word is not refused.
 */

/** Names that would pass for the product, its staff or the sport's bodies, or break an address. */
const RESERVED_HANDLES = [
	'admin',
	'administrator',
	'moderator',
	'mod',
	'staff',
	'support',
	'help',
	'official',
	'team',
	'system',
	'root',
	'api',
	'library',
	'pitwall',
	'example',
	'examples',
	'anonymous',
	'null',
	'undefined',
	'me',
	'you',
	'user',
	'users',
	'account',
	'billing',
	'security',
	'press',
	'news',
	'f1',
	'formula1',
	'formulaone',
	'fia',
	'fom'
];

/** A handle starting with one of these reads as an official account, whatever follows. */
const RESERVED_PREFIXES = ['pitwall', 'official', 'admin', 'support', 'staff', 'moderator'];

/** Words refused everywhere. Short ones count only as whole words, in a handle too. */
const BLOCKED_WORDS = [
	'fuck',
	'shit',
	'bitch',
	'cunt',
	'dick',
	'cock',
	'pussy',
	'asshole',
	'bastard',
	'slut',
	'whore',
	'nigger',
	'nigga',
	'faggot',
	'fag',
	'retard',
	'rapist',
	'rape',
	'nazi',
	'hitler',
	'kike',
	'spic',
	'chink',
	'twat',
	'wank',
	'wanker',
	'porn',
	'sex',
	'cum',
	'tits',
	'penis',
	'vagina',
	'anus',
	'ass',
	'arse'
];

/** Substrings are matched from this length: below it a word inside another is usually innocent. */
const SUBSTRING_MIN = 4;

const LEET = new Map([
	['0', 'o'],
	['1', 'i'],
	['3', 'e'],
	['4', 'a'],
	['5', 's'],
	['7', 't'],
	['8', 'b'],
	['@', 'a'],
	['$', 's']
]);

/** Real words that contain a blocked one; cleared before a handle is searched for substrings. */
const INNOCENT_WORDS = [
	'scunthorpe',
	'cockpit',
	'peacock',
	'dickens',
	'dickinson',
	'cocker',
	'hancock',
	'cockburn',
	'woodcock'
];

/** `sh1t` reads as `shit`; a `!` is an `i` only inside a word, so `fuck!` stays `fuck`. */
function unleet(text: string): string {
	return [...text.toLowerCase().replaceAll(/(?<=\p{L})!(?=\p{L})/gu, 'i')]
		.map((char) => LEET.get(char) ?? char)
		.join('');
}

export type Policy = {
	reservedHandles: readonly string[];
	blockedWords: readonly string[];
};

export type HandleCheck =
	{ ok: true; handle: string } | { ok: false; reason: 'format' | 'reserved' | 'profanity' };

/** Whether `handle`, as typed, may be taken. Uniqueness is the database's to check. */
export function checkHandle(raw: string, policy: Policy): HandleCheck {
	const handle = normalizeHandle(raw);

	if (!HANDLE_PATTERN.test(handle)) {
		return { ok: false, reason: 'format' };
	}

	const reserved = new Set([...RESERVED_HANDLES, ...policy.reservedHandles]);

	if (reserved.has(handle) || RESERVED_PREFIXES.some((prefix) => handle.startsWith(prefix))) {
		return { ok: false, reason: 'reserved' };
	}

	const words = [...BLOCKED_WORDS, ...policy.blockedWords];
	const parts = unleet(handle).split('_');
	const joined = INNOCENT_WORDS.reduce((text, word) => text.replaceAll(word, ''), parts.join(''));

	const blocked = words.some(
		(word) => parts.includes(word) || (word.length >= SUBSTRING_MIN && joined.includes(word))
	);

	return blocked ? { ok: false, reason: 'profanity' } : { ok: true, handle };
}

/** Whether a name, description or tag holds a blocked word. */
export function hasBlockedWord(text: string, policy: Policy): boolean {
	const words = new Set([...BLOCKED_WORDS, ...policy.blockedWords]);

	// Letters only, so punctuation never hides a word; digits were turned to letters first.
	return unleet(text)
		.split(/[^\p{L}]+/u)
		.some((token) => words.has(token));
}
