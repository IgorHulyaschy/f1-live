/**
 * Typo-tolerant matching for Ask: the palette's index and the question parser both rank names
 * with it, so "verstapen", "Leclrec" and "monza" find what they mean.
 */

/** Lower case, accents dropped, anything but letters and digits as one space. */
export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, ' ')
		.trim();
}

export function words(text: string): string[] {
	const normal = normalize(text);

	return normal === '' ? [] : normal.split(' ');
}

/** Edits from `a` to `b`, a swap of two neighbours counting as one; stops counting past `limit`. */
export function editDistance(a: string, b: string, limit: number): number {
	if (Math.abs(a.length - b.length) > limit) {
		return limit + 1;
	}

	let before: number[] = [];
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		let rowBest = i;

		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;

			let value = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + cost
			);

			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				value = Math.min(value, (before[j - 2] ?? 0) + 1);
			}

			current.push(value);
			rowBest = Math.min(rowBest, value);
		}

		if (rowBest > limit) {
			return limit + 1;
		}

		before = previous;
		previous = current;
	}

	return previous[b.length] ?? limit + 1;
}

/** Typos a word of this length may carry and still match: none under 5 letters, two from 8. */
export function typoAllowance(length: number): number {
	return length >= 8 ? 2 : length >= 5 ? 1 : 0;
}

/**
 * How well one typed word matches one word of a name, 0 to 1: equal, a prefix of it (while typing),
 * or within the typo allowance.
 */
export function wordScore(typed: string, word: string, prefix: boolean): number {
	if (typed === word) {
		return 1;
	}

	if (prefix && typed.length >= 2 && word.startsWith(typed)) {
		return 0.6 + 0.3 * (typed.length / word.length);
	}

	const allowance = typoAllowance(Math.min(typed.length, word.length));

	if (allowance === 0) {
		return 0;
	}

	const distance = editDistance(typed, word, allowance);

	return distance <= allowance ? 0.75 - 0.15 * distance : 0;
}

/**
 * How well a typed text matches a name, 0 to 1: every typed word must match a word of the name
 * (the last one may be half typed). Matching the name's words in order, and all of them, scores
 * higher.
 */
export function matchScore(typed: string, name: string): number {
	const query = words(typed);
	const target = words(name);

	if (query.length === 0 || target.length === 0) {
		return 0;
	}

	let total = 0;
	let lastIndex = -1;
	let inOrder = true;
	const used = new Set<number>();

	for (const [position, word] of query.entries()) {
		let best = 0;
		let bestIndex = -1;

		for (const [index, candidate] of target.entries()) {
			if (used.has(index)) {
				continue;
			}

			const score = wordScore(word, candidate, position === query.length - 1);

			if (score > best) {
				best = score;
				bestIndex = index;
			}
		}

		if (best === 0) {
			return 0;
		}

		used.add(bestIndex);
		inOrder &&= bestIndex > lastIndex;
		lastIndex = bestIndex;
		total += best;
	}

	const coverage = query.length / target.length;

	return (total / query.length) * (0.8 + 0.1 * coverage + (inOrder ? 0.1 : 0));
}

/** The best score over several names of one thing. */
export function bestMatch(typed: string, names: readonly string[]): number {
	return names.reduce((best, name) => Math.max(best, matchScore(typed, name)), 0);
}
