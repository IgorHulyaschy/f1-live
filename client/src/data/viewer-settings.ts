import { z } from 'zod';

import { EVENT_FILTERS } from '../insights/timeline.ts';
import { createLocalStore } from '../lib/local-store.ts';
import { MAX_DELAY_SECONDS } from './broadcast-delay.ts';

/** Seconds the live screen runs behind the feed, to match the viewer's TV. */
export const delayStore = createLocalStore(
	'pitwall-delay',
	z.number().min(0).max(MAX_DELAY_SECONDS),
	0
);

/** Sessions open at the start, and results stay hidden until the viewer asks for them. */
export const spoilerFreeStore = createLocalStore('pitwall-spoiler-free', z.boolean(), false);

/** Sessions whose results the viewer chose to see while spoiler-free; the newest few are kept. */
export const revealedStore = createLocalStore('pitwall-revealed', z.array(z.string()).max(50), []);

/** Which events the replay's event keys step through. */
export const eventFilterStore = createLocalStore(
	'pitwall-event-filter',
	z.enum(EVENT_FILTERS),
	'all'
);

/** Delay steps of a tenth, without the float drift of adding 0.1 repeatedly. */
export function stepDelay(seconds: number, step: number): number {
	return Math.min(Math.max(Math.round((seconds + step) * 10) / 10, 0), MAX_DELAY_SECONDS);
}
