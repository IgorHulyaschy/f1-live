import type {
	ChampionshipEvent,
	ClassificationCorrectionEvent,
	LapCompletedEvent,
	PenaltyEvent,
	PitExitEvent,
	PitLaneTimeEvent,
	RaceEvent,
	RetirementEvent,
	StandingEvent,
	TrackStatusEvent,
	TyresFittedEvent,
	WeatherEvent
} from './events.ts';
import { TRACK_STATUSES } from './race.ts';
import type { Lap, RaceSnapshot, Standing, Stint, TrackStatus } from './race.ts';

/** The state before any event: an unnamed session with nothing known yet. */
export const EMPTY_SNAPSHOT: RaceSnapshot = {
	session: {
		id: '',
		meetingName: '',
		circuit: '',
		countryCode: '',
		type: 'race',
		totalLaps: 0,
		startsAt: ''
	},
	currentLap: 0,
	trackStatus: 'green',
	drivers: [],
	startingGrid: [],
	laps: [],
	stints: [],
	pitStops: [],
	raceControl: [],
	weather: [],
	retirements: [],
	status: 'inactive',
	standings: [],
	statusLog: [],
	trackStatusLog: [],
	penalties: [],
	personalBests: [],
	corrections: []
};

/** Folds one event into the snapshot. Pure: `state` is never changed. */
export function applyEvent(state: RaceSnapshot, event: RaceEvent): RaceSnapshot {
	switch (event.kind) {
		case 'session_info':
			return { ...state, session: { ...event.session, totalLaps: state.session.totalLaps } };
		case 'session_status':
			return {
				...state,
				status: event.status,
				startedAt: state.startedAt ?? (event.status === 'started' ? event.at : undefined),
				statusLog: [...(state.statusLog ?? []), { at: event.at, status: event.status }]
			};
		case 'race_distance':
			return { ...state, session: { ...state.session, totalLaps: event.totalLaps } };
		case 'driver_entry':
			return {
				...state,
				drivers: upsert(
					state.drivers,
					event.driver,
					(driver) => driver.number === event.driver.number
				)
			};
		case 'grid_position':
			return {
				...state,
				startingGrid: upsert(
					state.startingGrid,
					{ driverNumber: event.driverNumber, position: event.position },
					(slot) => slot.driverNumber === event.driverNumber
				).toSorted((a, b) => a.position - b.position)
			};
		case 'standing':
			return applyStanding(state, event);
		case 'lap_completed':
			return applyLap(state, event);
		case 'tyres_fitted':
			return applyTyres(state, event);
		case 'pit_entry':
			return withStanding(state, { ...standingOf(state, event.driverNumber), inPit: true });
		case 'pit_exit':
			return applyPitExit(state, event);
		case 'pit_lane_time':
			return applyPitLaneTime(state, event);
		case 'track_status':
			return applyTrackStatus(state, event);
		case 'race_control':
			return {
				...state,
				raceControl: [...state.raceControl, { ...event.message, at: event.at }]
			};
		case 'weather':
			return applyWeather(state, event);
		case 'retirement':
			return applyRetirement(state, event);
		case 'penalty':
			return applyPenalty(state, event);
		case 'personal_best':
			return {
				...state,
				personalBests: upsert(
					state.personalBests ?? [],
					event.best,
					(best) => best.driverNumber === event.best.driverNumber
				)
			};
		case 'classification_correction':
			return applyCorrection(state, event);
		case 'overtake':
			return {
				...state,
				overtakes: [
					...(state.overtakes ?? []),
					{
						driverNumber: event.driverNumber,
						lap: lapAt(state, event.driverNumber, event.at),
						count: event.count,
						at: event.at
					}
				]
			};
		case 'team_radio':
			return {
				...state,
				teamRadio: [
					...(state.teamRadio ?? []),
					{
						driverNumber: event.driverNumber,
						lap: lapAt(state, event.driverNumber, event.at),
						at: event.at,
						path: event.path
					}
				]
			};
		case 'championship':
			return applyChampionship(state, event);
	}
}

function upsert<T>(items: readonly T[], item: T, matches: (existing: T) => boolean): T[] {
	const index = items.findIndex(matches);

	return index === -1 ? [...items, item] : items.with(index, item);
}

/** The lap a driver was on at `at`: one past the laps it had completed by then. */
function lapAt(state: RaceSnapshot, driverNumber: string, at: string): number {
	const done = state.laps.filter(
		(lap) =>
			lap.driverNumber === driverNumber && lap.completedAt !== undefined && lap.completedAt <= at
	);

	return 1 + Math.max(0, ...done.map((lap) => lap.lap));
}

function standingOf(state: RaceSnapshot, driverNumber: string): Standing {
	const standings = state.standings ?? [];

	return (
		standings.find((standing) => standing.driverNumber === driverNumber) ?? {
			driverNumber,
			position: standings.length + 1,
			gapToLeaderMs: null,
			intervalMs: null,
			lapsCompleted: 0,
			inPit: false,
			retired: false,
			disqualified: false
		}
	);
}

function withStanding(state: RaceSnapshot, standing: Standing): RaceSnapshot {
	return {
		...state,
		standings: upsert(
			state.standings ?? [],
			standing,
			(existing) => existing.driverNumber === standing.driverNumber
		).toSorted((a, b) => a.position - b.position)
	};
}

function applyStanding(state: RaceSnapshot, event: StandingEvent): RaceSnapshot {
	// Corrections are decided after the feed ends, so its order no longer stands once one is in.
	if ((state.corrections ?? []).length > 0) {
		return state;
	}

	return withStanding(state, {
		...standingOf(state, event.driverNumber),
		position: event.position,
		gapToLeaderMs: event.gapToLeaderMs,
		intervalMs: event.intervalMs
	});
}

function isRace(state: RaceSnapshot): boolean {
	return state.session.type === 'race' || state.session.type === 'sprint';
}

function applyLap(state: RaceSnapshot, event: LapCompletedEvent): RaceSnapshot {
	const isOwn = (lap: Lap) => lap.driverNumber === event.driverNumber;
	const existing = state.laps.find((lap) => isOwn(lap) && lap.lap === event.lap);

	if (existing) {
		const lapTimeMs = event.lapTimeMs ?? existing.lapTimeMs;
		const corrected = { ...existing, lapTimeMs, sectorTimesMs: sectors(event, lapTimeMs) };

		return { ...state, laps: state.laps.map((lap) => (lap === existing ? corrected : lap)) };
	}

	const standing = standingOf(state, event.driverNumber);
	const previous = state.laps.find((lap) => isOwn(lap) && lap.lap === event.lap - 1);
	const lapStartedAt = event.lap === 1 ? state.startedAt : previous?.completedAt;
	const timedFrom = isRace(state) ? lapStartedAt : undefined;
	const lapTimeMs = event.lapTimeMs ?? derivedLapTime(event, timedFrom);
	const stint = stintOn(state.stints, event.driverNumber, event.lap);
	const otherRows = state.laps.filter((lap) => lap.lap === event.lap);

	const row: Lap = {
		driverNumber: event.driverNumber,
		lap: event.lap,
		lapTimeMs,
		sectorTimesMs: sectors(event, lapTimeMs),
		position: standing.position,
		gapToLeaderMs: isRace(state)
			? gapAtTheLine(standing, otherRows, event.at)
			: (standing.gapToLeaderMs ?? 0),
		intervalMs: standing.intervalMs ?? 0,
		compound: stint?.compound ?? 'UNKNOWN',
		tyreAge: stint ? tyreAgeOn(stint, event.lap) : event.lap,
		pitIn: standing.inPit,
		pitOut: state.pitStops.some(
			(stop) => stop.driverNumber === event.driverNumber && stop.lap === event.lap - 1
		),
		trackStatus: worstTrackStatus(state, lapStartedAt ?? event.at, event.at),
		completedAt: event.at
	};

	const lapRows = isRace(state) ? rankAtTheLine([...otherRows, row]) : [...otherRows, row];

	return {
		...withStanding(state, {
			...standing,
			lapsCompleted: Math.max(standing.lapsCompleted, event.lap)
		}),
		currentLap: Math.max(state.currentLap, event.lap),
		laps: [...state.laps.filter((lap) => lap.lap !== event.lap), ...lapRows].toSorted(
			(a, b) => a.lap - b.lap || a.position - b.position
		),
		stints: state.stints.map((entry) =>
			entry === stint ? { ...entry, endLap: Math.max(entry.endLap, event.lap) } : entry
		)
	};
}

/**
 * A lap time the source left out: the sum of its sectors when all three are known, otherwise,
 * in a race, the time since the previous crossing (for lap 1, since the start), which carries
 * the feed's publishing delay of a few tenths. Outside races an untimed lap stays 0.
 */
function derivedLapTime(event: LapCompletedEvent, lapStartedAt: string | undefined): number {
	const [first, second, third] = event.sectorTimesMs;

	if (first !== null && second !== null && third !== null) {
		return first + second + third;
	}

	return lapStartedAt === undefined ? 0 : Date.parse(event.at) - Date.parse(lapStartedAt);
}

/** Fills a single missing sector from the lap time; any other gap stays 0. */
function sectors(event: LapCompletedEvent, lapTimeMs: number): readonly [number, number, number] {
	const known = event.sectorTimesMs.filter((time) => time !== null);
	const missing = lapTimeMs - known.reduce((sum, time) => sum + time, 0);
	const fill = known.length === 2 && missing > 0 ? missing : 0;
	const [first, second, third] = event.sectorTimesMs;

	return [first ?? fill, second ?? fill, third ?? fill];
}

/**
 * The gap the source published when the car crossed the line; for a lapped car, which has
 * none, the time since the first car completed this lap.
 */
function gapAtTheLine(standing: Standing, otherRows: readonly Lap[], at: string): number {
	if (standing.gapToLeaderMs !== null) {
		return standing.gapToLeaderMs;
	}

	const firstAt = Math.min(...otherRows.map(crossedAt));

	return otherRows.length > 0 ? Date.parse(at) - firstAt : 0;
}

function crossedAt(lap: Lap): number {
	return lap.completedAt === undefined ? 0 : Date.parse(lap.completedAt);
}

/**
 * Orders one lap's crossings by their gap, so a lap's positions are unique and match its
 * gaps even when the feed reorders the field after a car crosses, as when it applies a time
 * penalty at the flag.
 */
function rankAtTheLine(rows: readonly Lap[]): Lap[] {
	const ranked = rows.toSorted(
		(a, b) => a.gapToLeaderMs - b.gapToLeaderMs || crossedAt(a) - crossedAt(b)
	);

	return ranked.map((row, index) => ({
		...row,
		position: index + 1,
		intervalMs: index === 0 ? 0 : row.gapToLeaderMs - (ranked[index - 1]?.gapToLeaderMs ?? 0)
	}));
}

function stintOn(stints: readonly Stint[], driverNumber: string, lap: number): Stint | undefined {
	return stints.findLast((stint) => stint.driverNumber === driverNumber && stint.startLap <= lap);
}

function tyreAgeOn(stint: Stint, lap: number): number {
	return lap - stint.startLap + 1 + (stint.tyreAgeAtStart ?? 0);
}

function severity(status: TrackStatus): number {
	return TRACK_STATUSES.indexOf(status);
}

/** The most serious track status in force at any time from `from` to `to`. */
function worstTrackStatus(state: RaceSnapshot, from: string, to: string): TrackStatus {
	const fromMs = Date.parse(from);
	const toMs = Date.parse(to);
	let worst: TrackStatus = 'green';

	for (const change of state.trackStatusLog ?? []) {
		const changedAt = Date.parse(change.at);

		if (changedAt > toMs) {
			break;
		}

		if (changedAt <= fromMs) {
			worst = change.status;
		} else if (severity(change.status) > severity(worst)) {
			worst = change.status;
		}
	}

	return worst;
}

/** Stints are keyed by their first lap, so a source that reports one twice corrects it. */
function applyTyres(state: RaceSnapshot, event: TyresFittedEvent): RaceSnapshot {
	const fitted: Stint = {
		driverNumber: event.driverNumber,
		stint: 0,
		compound: event.compound,
		startLap: event.startLap,
		endLap: event.startLap,
		tyreAgeAtStart: event.tyreAgeAtStart
	};

	const own = upsert(
		state.stints.filter((stint) => stint.driverNumber === event.driverNumber),
		fitted,
		(stint) => stint.startLap === event.startLap
	).toSorted((a, b) => a.startLap - b.startLap);

	const { lapsCompleted } = standingOf(state, event.driverNumber);

	const renumbered = own.map((stint, index) => {
		const next = own[index + 1];

		return {
			...stint,
			stint: index + 1,
			endLap: next ? next.startLap - 1 : Math.max(stint.startLap, lapsCompleted)
		};
	});

	const others = state.stints.filter((stint) => stint.driverNumber !== event.driverNumber);
	const first = state.stints.findIndex((stint) => stint.driverNumber === event.driverNumber);

	return {
		...state,
		stints: others.toSpliced(first === -1 ? others.length : first, 0, ...renumbered),
		laps: state.laps.map((lap) => {
			if (lap.driverNumber !== event.driverNumber) {
				return lap;
			}

			const stint = stintOn(renumbered, lap.driverNumber, lap.lap);

			return stint ? { ...lap, compound: stint.compound, tyreAge: tyreAgeOn(stint, lap.lap) } : lap;
		})
	};
}

function applyPitExit(state: RaceSnapshot, event: PitExitEvent): RaceSnapshot {
	const known = state.pitStops.some(
		(stop) => stop.driverNumber === event.driverNumber && stop.lap === event.lap
	);

	const pitStops = known
		? state.pitStops
		: [
				...state.pitStops,
				{ driverNumber: event.driverNumber, lap: event.lap, laneTimeMs: event.laneTimeMs }
			];

	return withStanding(
		{ ...state, pitStops },
		{ ...standingOf(state, event.driverNumber), inPit: false }
	);
}

function applyPitLaneTime(state: RaceSnapshot, event: PitLaneTimeEvent): RaceSnapshot {
	const { stop } = event;

	const index = state.pitStops.findIndex(
		(existing) => existing.driverNumber === stop.driverNumber && existing.lap === stop.lap
	);

	return {
		...state,
		pitStops: index === -1 ? [...state.pitStops, stop] : state.pitStops.with(index, stop)
	};
}

function applyTrackStatus(state: RaceSnapshot, event: TrackStatusEvent): RaceSnapshot {
	const log = state.trackStatusLog ?? [];

	return {
		...state,
		trackStatus: event.status,
		trackStatusLog:
			log.at(-1)?.status === event.status ? log : [...log, { at: event.at, status: event.status }]
	};
}

/** One sample per lap, the latest; `lap` is the lap the leader is on. */
function applyWeather(state: RaceSnapshot, event: WeatherEvent): RaceSnapshot {
	const { totalLaps } = state.session;
	const lap = totalLaps > 0 ? Math.min(state.currentLap + 1, totalLaps) : state.currentLap + 1;

	return {
		...state,
		weather: upsert(state.weather, { ...event.sample, lap }, (sample) => sample.lap === lap)
	};
}

/**
 * A car that stops in the garage retires after its in-lap; one that stops on track retires on
 * the lap it was driving.
 */
function applyRetirement(state: RaceSnapshot, event: RetirementEvent): RaceSnapshot {
	const standing = standingOf(state, event.driverNumber);

	if (standing.retired) {
		return state;
	}

	const lap = Math.max(1, standing.inPit ? standing.lapsCompleted : standing.lapsCompleted + 1);

	return withStanding(
		{
			...state,
			retirements: [
				...state.retirements,
				{ driverNumber: event.driverNumber, lap, reason: event.reason, at: event.at }
			]
		},
		{ ...standing, retired: true }
	);
}

function applyPenalty(state: RaceSnapshot, event: PenaltyEvent): RaceSnapshot {
	const penalties = state.penalties ?? [];
	const { penalty } = event;

	if (penalty.status === 'issued') {
		return { ...state, penalties: [...penalties, penalty] };
	}

	const index = penalties.findIndex(
		(issued) =>
			issued.status === 'issued' &&
			issued.driverNumber === penalty.driverNumber &&
			issued.kind === penalty.kind &&
			issued.seconds === penalty.seconds
	);

	const issued = penalties[index];

	if (!issued) {
		return penalty.status === 'served'
			? { ...state, penalties: [...penalties, { ...penalty, servedLap: penalty.lap }] }
			: state;
	}

	return {
		...state,
		penalties: penalties.with(
			index,
			penalty.status === 'served'
				? { ...issued, status: 'served', servedLap: penalty.lap }
				: { ...issued, status: 'revoked' }
		)
	};
}

function applyChampionship(state: RaceSnapshot, event: ChampionshipEvent): RaceSnapshot {
	const { drivers, teams } = state.championship ?? { drivers: [], teams: [] };

	return {
		...state,
		championship: {
			drivers: event.standings.drivers.reduce(
				(merged, place) =>
					upsert(merged, place, (existing) => existing.driverNumber === place.driverNumber),
				drivers
			),
			teams: event.standings.teams.reduce(
				(merged, place) => upsert(merged, place, (existing) => existing.team === place.team),
				teams
			)
		}
	};
}

function applyCorrection(state: RaceSnapshot, event: ClassificationCorrectionEvent): RaceSnapshot {
	const { correction } = event;
	const standings = state.standings ?? [];

	return {
		...state,
		corrections: [...(state.corrections ?? []), { ...correction, at: event.at }],
		standings:
			correction.kind === 'disqualified'
				? disqualify(standings, correction.driverNumber)
				: addTime(standings, correction.driverNumber, (correction.seconds ?? 0) * 1000)
	};
}

/**
 * Everyone behind moves up a place, and disqualified cars go to the back in the order they were
 * excluded.
 */
function disqualify(standings: readonly Standing[], driverNumber: string): readonly Standing[] {
	const excluded = standings.find((standing) => standing.driverNumber === driverNumber);

	if (!excluded || excluded.disqualified) {
		return standings;
	}

	return standings
		.map((standing) => {
			if (standing === excluded) {
				return { ...standing, position: standings.length, disqualified: true };
			}

			return standing.position > excluded.position
				? { ...standing, position: standing.position - 1 }
				: standing;
		})
		.toSorted((a, b) => a.position - b.position);
}

/**
 * Adds time to a car's race time and re-sorts the cars on the leader's lap that have a time
 * gap. A car a lap or more down keeps its place.
 */
function addTime(
	standings: readonly Standing[],
	driverNumber: string,
	addedMs: number
): readonly Standing[] {
	const penalised = standings.find((standing) => standing.driverNumber === driverNumber);

	const leadLap = standings.filter(
		(standing) =>
			!standing.retired &&
			!standing.disqualified &&
			standing.gapToLeaderMs !== null &&
			standing.lapsCompleted === penalised?.lapsCompleted
	);

	const positions = leadLap.map((standing) => standing.position).toSorted((a, b) => a - b);

	if (!penalised || !leadLap.includes(penalised) || positions[0] !== 1) {
		return standings;
	}

	const totals = leadLap
		.map((standing) => ({
			standing,
			totalMs: (standing.gapToLeaderMs ?? 0) + (standing === penalised ? addedMs : 0)
		}))
		.toSorted((a, b) => a.totalMs - b.totalMs);

	const leadMs = totals[0]?.totalMs ?? 0;

	const resorted = new Map(
		totals.map(({ standing, totalMs }, index) => [
			standing.driverNumber,
			{
				...standing,
				position: positions[index] ?? standing.position,
				gapToLeaderMs: totalMs - leadMs,
				intervalMs: totalMs - (totals[index - 1]?.totalMs ?? totalMs)
			}
		])
	);

	return standings
		.map((standing) => resorted.get(standing.driverNumber) ?? standing)
		.toSorted((a, b) => a.position - b.position);
}
