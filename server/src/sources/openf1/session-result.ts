import { readFile } from 'node:fs/promises';

import type { ClassificationCorrectionEvent } from '@f1-live/shared';
import { z } from 'zod';

import type { CorrectionSource, CorrectionTarget } from '../../import/corrections.js';
import { openF1CacheOf } from '../../sinks/files.js';

/** History is free and needs no key; the terms for commercial use are an open organisational item. */
export const OPENF1_URL = 'https://api.openf1.org/v1';

const sessionResultSchema = z.array(
	z.object({
		session_key: z.number(),
		driver_number: z.number(),
		dsq: z.boolean()
	})
);

export type SessionResultRow = z.output<typeof sessionResultSchema>[number];

export function parseSessionResult(text: string): SessionResultRow[] {
	return sessionResultSchema.parse(JSON.parse(text));
}

/** A disqualification in the result becomes a correction; OpenF1 gives no reason or time. */
export function correctionsFromResult(
	rows: readonly SessionResultRow[],
	endedAt: string
): ClassificationCorrectionEvent[] {
	return rows
		.filter((row) => row.dsq)
		.toSorted((a, b) => a.driver_number - b.driver_number)
		.map((row) => ({
			kind: 'classification_correction',
			at: endedAt,
			correction: {
				driverNumber: String(row.driver_number),
				kind: 'disqualified',
				reason: 'Disqualified, as the OpenF1 session result lists it'
			}
		}));
}

/** Reads the session result the import saved at `openF1CacheOf`; none when it saved nothing. */
export class OpenF1Corrections implements CorrectionSource {
	private readonly dataDir: string;

	constructor(dataDir: string) {
		this.dataDir = dataDir;
	}

	async load({ key, endedAt }: CorrectionTarget): Promise<ClassificationCorrectionEvent[]> {
		const text = await readFile(openF1CacheOf(this.dataDir, key), 'utf8').catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') {
					return null;
				}

				throw error;
			}
		);

		return text === null ? [] : correctionsFromResult(parseSessionResult(text), endedAt);
	}
}
