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

export interface Session {
	id: string;
	meetingName: string;
	circuit: string;
	countryCode: string;
	type: SessionType;
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
}

export interface Stint {
	driverNumber: string;
	stint: number;
	compound: TyreCompound;
	startLap: number;
	/** Last lap of the stint; equals the current lap while the stint is running. */
	endLap: number;
}

export interface PitStop {
	driverNumber: string;
	lap: number;
	/** Total time lost in the pit lane, from entry to exit. */
	laneTimeMs: number;
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
}

export interface WeatherSample {
	lap: number;
	airTempC: number;
	trackTempC: number;
	humidityPct: number;
	windSpeedMs: number;
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
}
