import type { RaceSnapshot } from '@f1-live/shared';

import { loadRaceFromApi } from './api-source.ts';
import { simulateLasVegas2025 } from './mock/simulate-race.ts';

export type RaceSourceKind = 'mock' | 'api';

/** Loads everything known about the session; the UI slices it per lap. */
export type RaceSource = {
	kind: RaceSourceKind;
	load: () => Promise<RaceSnapshot>;
};

export function createRaceSource(kind: RaceSourceKind, apiUrl: string): RaceSource {
	if (kind === 'api') {
		return { kind, load: () => loadRaceFromApi(apiUrl) };
	}

	return { kind, load: () => Promise.resolve(simulateLasVegas2025()) };
}

export function raceSourceKindFromEnv(value: string | undefined): RaceSourceKind {
	return value === 'api' ? 'api' : 'mock';
}
