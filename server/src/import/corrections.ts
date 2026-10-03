import type { ClassificationCorrectionEvent, RaceSnapshot, Standing } from '@f1-live/shared';

/** Where a session's corrections come from; one source per provider or file. */
export interface CorrectionSource {
	/** Corrections decided after the session's own feed ended; empty when the source has none. */
	load(session: CorrectionTarget): Promise<readonly ClassificationCorrectionEvent[]>;
}

export interface CorrectionTarget {
	key: number;
	/** When the session's own events end, ISO 8601 UTC, for sources that do not date a decision. */
	endedAt: string;
	/** The running order the session's own events ended with, for sources that publish the official one. */
	standings: readonly Standing[];
	/** The session as its own events left it. */
	snapshot: RaceSnapshot;
}

function conflictKey(event: ClassificationCorrectionEvent): string {
	return `${event.correction.driverNumber}:${event.correction.kind}`;
}

/**
 * Corrections of every source in time order. A later source wins a conflict: it replaces all
 * earlier corrections of the same kind for the same driver.
 */
export function mergeCorrections(
	sources: readonly (readonly ClassificationCorrectionEvent[])[]
): ClassificationCorrectionEvent[] {
	const merged: ClassificationCorrectionEvent[] = [];

	for (const events of sources) {
		const replaced = new Set(events.map(conflictKey));

		merged.splice(
			0,
			merged.length,
			...merged.filter((event) => !replaced.has(conflictKey(event))),
			...events
		);
	}

	return merged.toSorted(
		(a, b) =>
			a.at.localeCompare(b.at) ||
			Number(a.correction.driverNumber) - Number(b.correction.driverNumber) ||
			a.correction.kind.localeCompare(b.correction.kind)
	);
}
