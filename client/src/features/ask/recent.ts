import { z } from 'zod';

import { createLocalStore } from '@/lib/local-store';

const MAX_RECENT = 5;

/** Questions the viewer asked and followed, newest first. */
export const recentQuestions = createLocalStore('pitwall-ask-recent', z.array(z.string()), []);

export function rememberQuestion(text: string): void {
	const recent = recentQuestions.get();

	if (recent[0] !== text) {
		recentQuestions.set([text, ...recent.filter((entry) => entry !== text)].slice(0, MAX_RECENT));
	}
}
