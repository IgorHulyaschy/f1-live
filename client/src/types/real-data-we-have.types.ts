export type Lap = {
	id: string;
	driverNumber: string;
	lapNumber: number;
	sector1Time?: number | null;
	sector2Time?: number | null;
	sector3Time?: number | null;
	time?: number | null;
	sessionId: string;
};

export type Driver = {
	id: string;
	name: string;
	number: number;
	team: string;
	avatarUrl?: string | null;
	shortName: string;
};

export type SessionType = 'race' | 'qualifying' | 'sprint' | 'sprint_qualifying' | 'practice';

export type Session = {
	id: string;
	name: string;
	country: string;
	type: SessionType;
	data: Date;
};

export type DriverWithLaps = Driver & {
	laps: Lap[];
};

export type RestInfo = {
	session: Session;
	driversLapsData: DriverWithLaps[];
};
