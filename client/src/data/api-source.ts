import type { Driver, Lap, RaceSnapshot } from '@f1-live/shared';

/** Response of the server's GET /onLoad (see server/src/api/http/onLoad.ts). */
type OnLoadResponse = {
	session: { id: string; name: string; country: string; type: string; date: string } | null;
	driversLapsData: {
		number: string;
		name: string;
		team: string;
		shortName: string;
		laps: {
			lapNumber: number;
			sector1Time: number | null;
			sector2Time: number | null;
			sector3Time: number | null;
			time: number | null;
		}[];
	}[];
};

/**
 * Maps the server's current, lap-times-only API onto the race contract. Positions and gaps are
 * derived from summed lap times; tyres, pit stops, race control and weather are not served yet.
 */
export async function loadRaceFromApi(apiUrl: string): Promise<RaceSnapshot> {
	const response = await fetch(`${apiUrl}/onLoad`);

	if (!response.ok) {
		throw new Error(`GET /onLoad failed with ${response.status}`);
	}

	// SAFETY: the response body is produced by this repository's server (onLoad.ts).
	const body = (await response.json()) as OnLoadResponse;

	const drivers: Driver[] = body.driversLapsData.map((driver) => {
		const [firstName = '', ...rest] = driver.name.split(' ');

		return {
			number: driver.number,
			code: driver.shortName,
			firstName,
			lastName: rest.join(' '),
			team: driver.team,
			teamColour: '888888'
		};
	});

	const totals = new Map<string, number>();

	const completed = body.driversLapsData
		.flatMap((driver) =>
			driver.laps.map((lap) => ({ driverNumber: driver.number, ...lap, time: lap.time ?? 0 }))
		)
		.filter((lap) => lap.time > 0)
		.toSorted((a, b) => a.lapNumber - b.lapNumber);

	const laps: Lap[] = [];
	const currentLap = Math.max(0, ...completed.map((lap) => lap.lapNumber));

	for (let lapNumber = 1; lapNumber <= currentLap; lapNumber++) {
		const crossings = completed
			.filter((lap) => lap.lapNumber === lapNumber)
			.map((lap) => {
				const total = (totals.get(lap.driverNumber) ?? 0) + lap.time;

				totals.set(lap.driverNumber, total);

				return { lap, total };
			})
			.toSorted((a, b) => a.total - b.total);

		const leader = crossings[0]?.total ?? 0;

		for (const [index, { lap, total }] of crossings.entries()) {
			laps.push({
				driverNumber: lap.driverNumber,
				lap: lapNumber,
				lapTimeMs: lap.time,
				sectorTimesMs: [lap.sector1Time ?? 0, lap.sector2Time ?? 0, lap.sector3Time ?? 0],
				position: index + 1,
				gapToLeaderMs: total - leader,
				intervalMs: index === 0 ? 0 : total - (crossings[index - 1]?.total ?? total),
				compound: 'UNKNOWN',
				tyreAge: lapNumber,
				pitIn: false,
				pitOut: false,
				trackStatus: 'green'
			});
		}
	}

	return {
		session: {
			id: body.session?.id ?? 'unknown',
			meetingName: body.session?.name ?? 'Unknown session',
			circuit: body.session?.name ?? '',
			countryCode: body.session?.country ?? '',
			type: 'race',
			totalLaps: Math.max(currentLap, 1),
			startsAt: body.session?.date ?? new Date().toISOString()
		},
		currentLap: Math.max(currentLap, 1),
		trackStatus: 'green',
		drivers,
		startingGrid: [],
		laps,
		stints: [],
		pitStops: [],
		raceControl: [],
		weather: [],
		retirements: []
	};
}
