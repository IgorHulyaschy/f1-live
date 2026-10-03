/**
 * Facts about a session, in the order they happened, whoever reported them: the official timing
 * feed, OpenF1 or a licensed provider all emit these. `applyEvent` folds them into a
 * `RaceSnapshot`. `at` is when the fact happened or was published, ISO 8601 UTC.
 */

import type {
	ClassificationCorrection,
	Driver,
	Penalty,
	PersonalBest,
	PitStop,
	RaceControlMessage,
	Session,
	SessionStatus,
	TrackStatus,
	TyreCompound,
	WeatherSample
} from './race.ts';

export interface SessionInfoEvent {
	kind: 'session_info';
	at: string;
	session: Omit<Session, 'totalLaps'>;
}

export interface SessionStatusEvent {
	kind: 'session_status';
	at: string;
	status: SessionStatus;
}

export interface RaceDistanceEvent {
	kind: 'race_distance';
	at: string;
	totalLaps: number;
}

export interface DriverEntryEvent {
	kind: 'driver_entry';
	at: string;
	driver: Driver;
}

export interface GridPositionEvent {
	kind: 'grid_position';
	at: string;
	driverNumber: string;
	position: number;
}

/**
 * A car crossed the line. Times the source does not publish are null, as for the first lap of
 * a race; the reducer derives them. Sent again for the same lap when the source corrects it.
 */
export interface LapCompletedEvent {
	kind: 'lap_completed';
	at: string;
	driverNumber: string;
	lap: number;
	lapTimeMs: number | null;
	sectorTimesMs: readonly [number | null, number | null, number | null];
}

/** A driver's position and gaps now, between lap crossings too. */
export interface StandingEvent {
	kind: 'standing';
	at: string;
	driverNumber: string;
	position: number;
	/** 0 for the leader; null when there is no time gap, as for a lapped car. */
	gapToLeaderMs: number | null;
	/** 0 for the leader; null when there is no time gap. */
	intervalMs: number | null;
}

/** Tyres for the stint that starts on `startLap`. Sent again when the source corrects it. */
export interface TyresFittedEvent {
	kind: 'tyres_fitted';
	at: string;
	driverNumber: string;
	startLap: number;
	compound: TyreCompound;
	/** Laps already on the set; 0 for a new set. */
	tyreAgeAtStart: number;
}

export interface PitEntryEvent {
	kind: 'pit_entry';
	at: string;
	driverNumber: string;
	/** The in-lap. */
	lap: number;
}

export interface PitExitEvent {
	kind: 'pit_exit';
	at: string;
	driverNumber: string;
	/** The in-lap, as on the entry. */
	lap: number;
	/** Entry to exit as the source timed it. */
	laneTimeMs: number;
}

/** The published times of a stop; they replace the measured lane time. */
export interface PitLaneTimeEvent {
	kind: 'pit_lane_time';
	at: string;
	stop: PitStop;
}

export interface TrackStatusEvent {
	kind: 'track_status';
	at: string;
	status: TrackStatus;
}

export interface RaceControlEvent {
	kind: 'race_control';
	at: string;
	message: Omit<RaceControlMessage, 'at'>;
}

export interface WeatherEvent {
	kind: 'weather';
	at: string;
	sample: Omit<WeatherSample, 'lap'>;
}

export interface RetirementEvent {
	kind: 'retirement';
	at: string;
	driverNumber: string;
	reason: string;
}

/**
 * The stewards issued a penalty, or report one served or revoked; `lap` is when they announced
 * it.
 */
export interface PenaltyEvent {
	kind: 'penalty';
	at: string;
	penalty: Omit<Penalty, 'servedLap'>;
}

export interface PersonalBestEvent {
	kind: 'personal_best';
	at: string;
	best: PersonalBest;
}

export interface ClassificationCorrectionEvent {
	kind: 'classification_correction';
	at: string;
	correction: Omit<ClassificationCorrection, 'at'>;
}

export type RaceEvent =
	| SessionInfoEvent
	| SessionStatusEvent
	| RaceDistanceEvent
	| DriverEntryEvent
	| GridPositionEvent
	| LapCompletedEvent
	| StandingEvent
	| TyresFittedEvent
	| PitEntryEvent
	| PitExitEvent
	| PitLaneTimeEvent
	| TrackStatusEvent
	| RaceControlEvent
	| WeatherEvent
	| RetirementEvent
	| PenaltyEvent
	| PersonalBestEvent
	| ClassificationCorrectionEvent;
