/**
 * Race Timing Feature Types
 */

/**
 * Driver data in the race timing table
 */
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

/**
 * Sector timing status
 */
export type SectorStatus = 'fastest' | 'pb' | 'yellow' | 'normal';

/**
 * Tire compound types
 */
export type TireCompound = 'S' | 'M' | 'H';

/**
 * Driver status on track
 */
export type DriverStatus = 'PIT' | 'OUT' | 'TRACK';

/**
 * Props for the driver row component
 */
export interface RowProps {
	driver: Driver;
	onActionClick: (driverId: string) => void;
	activeDropdown: string | null;
}

/**
 * Table column configuration
 */
export interface ColumnConfig {
	key: string;
	label: string;
	width: number;
	sticky?: 'left' | 'right';
	leftOffset?: number;
}

/**
 * Props for table header component
 */
export interface ThProps {
	config: ColumnConfig;
}
