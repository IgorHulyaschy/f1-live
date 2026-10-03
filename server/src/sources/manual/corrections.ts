import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { CORRECTION_KINDS } from '@f1-live/shared';
import type { ClassificationCorrectionEvent } from '@f1-live/shared';
import { z } from 'zod';

import type { CorrectionSource, CorrectionTarget } from '../../import/corrections.js';

/** Committed corrections, one `<key>.json` per session; see `README.md` there. */
export const MANUAL_CORRECTIONS_DIR = path.resolve(import.meta.dirname, '../../../corrections');

const manualCorrectionsSchema = z.object({
	key: z.number(),
	corrections: z.array(
		z
			.object({
				driverNumber: z.string().min(1),
				kind: z.enum(CORRECTION_KINDS),
				/** For a time penalty: the seconds added to the race time. */
				seconds: z.number().positive().optional(),
				reason: z.string().min(1),
				/** When the decision was published, ISO 8601 UTC. */
				at: z.iso.datetime(),
				/** Where the decision is published; it is not used, it keeps the file checkable. */
				source: z.url(),
				note: z.string().optional()
			})
			.refine(
				(correction) => correction.kind !== 'time_penalty' || correction.seconds !== undefined,
				{
					message: 'a time_penalty needs seconds'
				}
			)
	)
});

/** Parses a manual corrections file into events; throws when it does not match the format. */
export function parseManualCorrections(text: string, key: number): ClassificationCorrectionEvent[] {
	const file = manualCorrectionsSchema.parse(JSON.parse(text));

	if (file.key !== key) {
		throw new Error(`corrections file says session ${file.key}, expected ${key}`);
	}

	return file.corrections.map(({ at, driverNumber, kind, seconds, reason }) => {
		const correction: ClassificationCorrectionEvent['correction'] = { driverNumber, kind, reason };

		if (seconds !== undefined) {
			correction.seconds = seconds;
		}

		return { kind: 'classification_correction', at: new Date(at).toISOString(), correction };
	});
}

export class ManualCorrections implements CorrectionSource {
	private readonly directory: string;

	constructor(directory = MANUAL_CORRECTIONS_DIR) {
		this.directory = directory;
	}

	async load({ key }: CorrectionTarget): Promise<ClassificationCorrectionEvent[]> {
		const text = await readFile(path.join(this.directory, `${key}.json`), 'utf8').catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') {
					return null;
				}

				throw error;
			}
		);

		return text === null ? [] : parseManualCorrections(text, key);
	}
}
