import { z } from 'zod';

/**
 * What the app keeps on a history entry: how many driver or lap views were opened to reach it, so
 * closing them can step back past every one.
 */
export const entryStateSchema = z.object({ drillDepth: z.int().positive() });

export type EntryState = z.infer<typeof entryStateSchema>;

const historySchema = z.object({ usr: entryStateSchema });

/**
 * The current entry's state, for a replace of the address to pass on. Read at the moment of the
 * replace, it is never stale.
 */
export function entryState(): EntryState | null {
	const parsed = historySchema.safeParse(window.history.state);

	return parsed.success ? parsed.data.usr : null;
}
