/**
 * Simple Race Timing Feature Types
 */

// Re-export shared domain types
import type {
	Driver as SharedDriver,
	Lap as SharedLap,
	SessionType as SharedSessionType
} from '@f1-live/shared';

export type Driver = SharedDriver;
export type Lap = SharedLap;
export type SessionType = SharedSessionType;

// Client-specific Session type with Date object
export type Session = {
	id: string;
	name: string;
	country: string;
	type: SessionType;
	date: Date;
};

export type DriverWithLaps = Driver & {
	laps: Lap[];
};

export type RestInfo = {
	session: Session;
	driversLapsData: DriverWithLaps[];
};
