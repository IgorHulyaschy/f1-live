/** Race domain contract shared by the server (producer) and the client (consumer). */

export const TYRE_COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET', 'UNKNOWN'] as const;

export type TyreCompound = (typeof TYRE_COMPOUNDS)[number];

export const TRACK_STATUSES = ['green', 'yellow', 'vsc', 'safety_car', 'red'] as const;

export type TrackStatus = (typeof TRACK_STATUSES)[number];

export const SESSION_TYPES = [
	'race',
	'sprint',
	'qualifying',
	'sprint_qualifying',
	'practice'
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_STATUSES = [
	'inactive',
	'started',
	'aborted',
	'finished',
	'finalised',
	'ended'
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface Session {
	id: string;
	meetingName: string;
	circuit: string;
	countryCode: string;
	type: SessionType;
	/** As the organiser names it, e.g. "Practice 2" or "Sprint". */
	name?: string;
	totalLaps: number;
	/** ISO 8601, UTC. */
	startsAt: string;
}

export interface Driver {
	/** Racing number as published by the timing feed, e.g. "1" or "44". */
	number: string;
	/** Three-letter abbreviation, e.g. "VER". */
	code: string;
	firstName: string;
	lastName: string;
	team: string;
	/** Hex colour without the leading "#", as published by the timing feed. */
	teamColour: string;
	/** Headshot on formula1.com, as published by the timing feed (DriverList HeadshotUrl). */
	headshotUrl?: string;
	/**
	 * formula1.com media id of the driver's side-on picture (DriverList PublicIdRight), e.g.
	 * "common/f1/2025/mclaren/lannor01/2025mclarenlannor01right". The team's folder in it also
	 * locates the team logo and car.
	 */
	imageId?: string;
}

/** One completed lap for one driver, with the race state at the moment it was completed. */
export interface Lap {
	driverNumber: string;
	lap: number;
	lapTimeMs: number;
	sectorTimesMs: readonly [number, number, number];
	position: number;
	/** Gap to the leader when crossing the line; 0 for the leader. */
	gapToLeaderMs: number;
	/** Gap to the car directly ahead; 0 for the leader. */
	intervalMs: number;
	compound: TyreCompound;
	/** Laps completed on this set of tyres, including this one. */
	tyreAge: number;
	pitIn: boolean;
	pitOut: boolean;
	trackStatus: TrackStatus;
	/** When the car crossed the line, ISO 8601 UTC. Absent on the modelled replay. */
	completedAt?: string;
}

export interface Stint {
	driverNumber: string;
	stint: number;
	compound: TyreCompound;
	startLap: number;
	/** Last lap of the stint; equals the current lap while the stint is running. */
	endLap: number;
	/** Laps already on the set when it was fitted; 0 or absent for a new set. */
	tyreAgeAtStart?: number;
}

export interface PitStop {
	driverNumber: string;
	lap: number;
	/** Total time lost in the pit lane, from entry to exit. */
	laneTimeMs: number;
	/** Time stationary in the box, when the source publishes it. */
	stationaryMs?: number;
}

export const RACE_CONTROL_CATEGORIES = [
	'flag',
	'safety_car',
	'drs',
	'penalty',
	'incident',
	'other'
] as const;

export type RaceControlCategory = (typeof RACE_CONTROL_CATEGORIES)[number];

export interface RaceControlMessage {
	lap: number;
	category: RaceControlCategory;
	message: string;
	driverNumber?: string;
	/** When it was published, ISO 8601 UTC. Absent on the modelled replay. */
	at?: string;
}

export interface WeatherSample {
	lap: number;
	airTempC: number;
	trackTempC: number;
	humidityPct: number;
	windSpeedMs: number;
	/** Where the wind blows from, degrees clockwise from north; absent when the source has none. */
	windDirectionDeg?: number;
	rainfall: boolean;
}

export interface GridSlot {
	driverNumber: string;
	position: number;
}

export interface Retirement {
	driverNumber: string;
	lap: number;
	reason: string;
	/** When the feed reported it, ISO 8601 UTC; before the start means the car did not start. */
	at?: string;
}

/** A driver's place in the running order now, refreshed between lap crossings. */
export interface Standing {
	driverNumber: string;
	position: number;
	/** 0 for the leader; null when there is no time gap, as for a lapped car. */
	gapToLeaderMs: number | null;
	/** Gap to the car directly ahead; 0 for the leader, null when there is no time gap. */
	intervalMs: number | null;
	lapsCompleted: number;
	inPit: boolean;
	retired: boolean;
	disqualified: boolean;
}

export interface SessionStatusChange {
	/** ISO 8601, UTC. */
	at: string;
	status: SessionStatus;
}

export interface TrackStatusChange {
	/** ISO 8601, UTC. */
	at: string;
	status: TrackStatus;
}

export const PENALTY_KINDS = ['time', 'drive_through', 'stop_go', 'grid', 'reprimand'] as const;

export type PenaltyKind = (typeof PENALTY_KINDS)[number];

export const PENALTY_STATUSES = ['issued', 'served', 'revoked'] as const;

export type PenaltyStatus = (typeof PENALTY_STATUSES)[number];

/** A stewards' decision announced during the session. */
export interface Penalty {
	driverNumber: string;
	kind: PenaltyKind;
	/** For time and stop/go penalties. */
	seconds?: number;
	/** For grid penalties. */
	places?: number;
	reason: string;
	/** Lap on which it was given. */
	lap: number;
	status: PenaltyStatus;
	servedLap?: number;
}

export const CORRECTION_KINDS = ['disqualified', 'time_penalty'] as const;

export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

/** A change to the classification decided after the timing feed ends, such as a disqualification. */
export interface ClassificationCorrection {
	driverNumber: string;
	kind: CorrectionKind;
	/** Added to the race time, for a time penalty. */
	seconds?: number;
	reason: string;
	/** When it was decided, ISO 8601 UTC. */
	at: string;
}

/** Best speeds in km/h; null until the driver has set one. */
export interface TopSpeeds {
	intermediate1: number | null;
	intermediate2: number | null;
	finishLine: number | null;
	speedTrap: number | null;
}

/** A driver's best lap, sectors and speeds in the session, as the source ranks them. */
export interface PersonalBest {
	driverNumber: string;
	lapTimeMs: number | null;
	lap: number | null;
	sectorTimesMs: readonly [number | null, number | null, number | null];
	topSpeedsKph: TopSpeeds;
}

/** A pass the timing feed credited to the car that made it. */
export interface Overtake {
	driverNumber: string;
	/** The lap the car was on when it passed. */
	lap: number;
	/** Cars passed in the one move, usually 1. */
	count: number;
	/** When it happened, ISO 8601 UTC. */
	at: string;
}

/**
 * A team radio clip the feed announced. The audio belongs to Formula 1, so a viewer is linked to
 * it only where the deployment allows; `path` is the clip inside the session's archive folder.
 */
export interface TeamRadioClip {
	driverNumber: string;
	/** The lap the car was on when the clip was recorded. */
	lap: number;
	/** When it was recorded, ISO 8601 UTC. */
	at: string;
	path: string;
}

/** A place in the championship before this session, and where the source projects it now. */
export interface ChampionshipPlace {
	points: number;
	position: number;
	predictedPoints: number;
	predictedPosition: number;
}

export interface DriverChampionshipPlace extends ChampionshipPlace {
	driverNumber: string;
}

export interface TeamChampionshipPlace extends ChampionshipPlace {
	/** As `Driver.team` names it. */
	team: string;
}

export interface ChampionshipStandings {
	drivers: readonly DriverChampionshipPlace[];
	teams: readonly TeamChampionshipPlace[];
}

/** Everything known about a session up to `currentLap`. */
export interface RaceSnapshot {
	session: Session;
	currentLap: number;
	trackStatus: TrackStatus;
	drivers: readonly Driver[];
	startingGrid: readonly GridSlot[];
	laps: readonly Lap[];
	stints: readonly Stint[];
	pitStops: readonly PitStop[];
	raceControl: readonly RaceControlMessage[];
	weather: readonly WeatherSample[];
	retirements: readonly Retirement[];
	/** The fields below come from real data; the modelled replay leaves them out. */
	status?: SessionStatus;
	/** When the session started (for a race, the start signal), ISO 8601 UTC. */
	startedAt?: string;
	/** The running order now, by position. */
	standings?: readonly Standing[];
	/** Every change of status, in order; each part of a qualifying session starts with `started`. */
	statusLog?: readonly SessionStatusChange[];
	trackStatusLog?: readonly TrackStatusChange[];
	penalties?: readonly Penalty[];
	personalBests?: readonly PersonalBest[];
	corrections?: readonly ClassificationCorrection[];
	overtakes?: readonly Overtake[];
	teamRadio?: readonly TeamRadioClip[];
	/** Live, only with an F1 TV login; saved races have it from the archive. */
	championship?: ChampionshipStandings;
}
