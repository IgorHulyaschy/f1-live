export interface Driver {
	id: string;
	name: string;
	team: string;
	position: number;
	positionChange: number;
	lastLap: string;
	gap: string;
	interval: string;
	s1: string;
	s2: string;
	s3: string;
	s1Status: SectorStatus;
	s2Status: SectorStatus;
	s3Status: SectorStatus;
	tire: TireCompound;
	tireAge: number;
	laps: number;
	status: DriverStatus;
	hasFastestLap: boolean;
	inDRS: boolean;
}

export type SectorStatus = 'fastest' | 'pb' | 'yellow' | 'normal';

export type TireCompound = 'S' | 'M' | 'H';

export type DriverStatus = 'PIT' | 'OUT' | 'TRACK';

export interface RowProps {
	driver: Driver;
	onActionClick: (driverId: string) => void;
	activeDropdown: string | null;
}
