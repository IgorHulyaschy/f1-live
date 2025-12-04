import type { Driver, ColumnConfig } from './types';

/**
 * F1 Team Colors
 */
export const TEAM_COLORS = {
	'Red Bull Racing': '#3671C6',
	Ferrari: '#E8002D',
	McLaren: '#FF8000',
	Mercedes: '#27F4D2',
	'Aston Martin': '#229971',
	Alpine: '#FF87BC',
	Williams: '#64C4FF',
	RB: '#6692FF',
	'Kick Sauber': '#52E252',
	Haas: '#B6BABD'
};

/**
 * Table Column Configuration
 */
export const COLUMNS = {
	position: { width: 52, label: 'POS' },
	driver: { width: 170, label: 'DRIVER' },
	lastLap: { width: 95, label: 'LAST LAP' },
	gap: { width: 90, label: 'GAP' },
	interval: { width: 80, label: 'INT' },
	s1: { width: 75, label: 'S1' },
	s2: { width: 75, label: 'S2' },
	s3: { width: 75, label: 'S3' },
	tire: { width: 70, label: 'TIRE' },
	laps: { width: 55, label: 'LAPS' },
	status: { width: 85, label: 'STATUS' },
	actions: { width: 50, label: '' }
};

/**
 * Mocked Driver Data for Development
 */
export const MOCKED_DATA: Driver[] = [
	{
		id: 'VER',
		name: 'M. VERSTAPPEN',
		team: 'Red Bull Racing',
		position: 1,
		positionChange: 0,
		lastLap: '1:32.456',
		gap: 'LEADER',
		interval: '—',
		s1: '28.123',
		s2: '35.456',
		s3: '28.877',
		s1Status: 'fastest',
		s2Status: 'pb',
		s3Status: 'normal',
		tire: 'M',
		tireAge: 12,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: true,
		inDRS: false
	},
	{
		id: 'NOR',
		name: 'L. NORRIS',
		team: 'McLaren',
		position: 2,
		positionChange: 1,
		lastLap: '1:32.789',
		gap: '+2.345',
		interval: '+2.345',
		s1: '28.234',
		s2: '35.678',
		s3: '28.877',
		s1Status: 'pb',
		s2Status: 'normal',
		s3Status: 'pb',
		tire: 'S',
		tireAge: 8,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: true
	},
	{
		id: 'LEC',
		name: 'C. LECLERC',
		team: 'Ferrari',
		position: 3,
		positionChange: -1,
		lastLap: '1:33.012',
		gap: '+4.567',
		interval: '+2.222',
		s1: '28.345',
		s2: '35.789',
		s3: '28.878',
		s1Status: 'normal',
		s2Status: 'pb',
		s3Status: 'normal',
		tire: 'M',
		tireAge: 15,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: false
	},
	{
		id: 'SAI',
		name: 'C. SAINZ',
		team: 'Ferrari',
		position: 4,
		positionChange: 0,
		lastLap: '1:33.234',
		gap: '+8.901',
		interval: '+4.334',
		s1: '28.456',
		s2: '35.890',
		s3: '28.888',
		s1Status: 'yellow',
		s2Status: 'normal',
		s3Status: 'pb',
		tire: 'M',
		tireAge: 15,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: false
	},
	{
		id: 'HAM',
		name: 'L. HAMILTON',
		team: 'Ferrari',
		position: 5,
		positionChange: 2,
		lastLap: '1:33.456',
		gap: '+12.345',
		interval: '+3.444',
		s1: '28.567',
		s2: '35.901',
		s3: '28.988',
		s1Status: 'normal',
		s2Status: 'yellow',
		s3Status: 'normal',
		tire: 'H',
		tireAge: 22,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: false
	},
	{
		id: 'RUS',
		name: 'G. RUSSELL',
		team: 'Mercedes',
		position: 6,
		positionChange: 0,
		lastLap: '1:33.567',
		gap: '+15.678',
		interval: '+3.333',
		s1: '28.678',
		s2: '35.912',
		s3: '28.977',
		s1Status: 'pb',
		s2Status: 'normal',
		s3Status: 'yellow',
		tire: 'M',
		tireAge: 10,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: true
	},
	{
		id: 'PIA',
		name: 'O. PIASTRI',
		team: 'McLaren',
		position: 7,
		positionChange: -2,
		lastLap: '1:33.789',
		gap: '+18.901',
		interval: '+3.223',
		s1: '28.789',
		s2: '36.012',
		s3: '28.988',
		s1Status: 'normal',
		s2Status: 'fastest',
		s3Status: 'normal',
		tire: 'S',
		tireAge: 3,
		laps: 44,
		status: 'OUT',
		hasFastestLap: false,
		inDRS: false
	},
	{
		id: 'ALO',
		name: 'F. ALONSO',
		team: 'Aston Martin',
		position: 8,
		positionChange: 0,
		lastLap: '1:33.890',
		gap: '+22.345',
		interval: '+3.444',
		s1: '28.890',
		s2: '36.012',
		s3: '28.988',
		s1Status: 'yellow',
		s2Status: 'yellow',
		s3Status: 'normal',
		tire: 'M',
		tireAge: 18,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: false
	},
	{
		id: 'STR',
		name: 'L. STROLL',
		team: 'Aston Martin',
		position: 9,
		positionChange: 1,
		lastLap: '1:34.012',
		gap: '+25.678',
		interval: '+3.333',
		s1: '28.901',
		s2: '36.123',
		s3: '28.988',
		s1Status: 'normal',
		s2Status: 'normal',
		s3Status: 'yellow',
		tire: 'H',
		tireAge: 25,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: false
	},
	{
		id: 'GAS',
		name: 'P. GASLY',
		team: 'Alpine',
		position: 10,
		positionChange: -1,
		lastLap: '—',
		gap: '+28.901',
		interval: '+3.223',
		s1: '—',
		s2: '—',
		s3: '—',
		s1Status: 'normal',
		s2Status: 'normal',
		s3Status: 'normal',
		tire: 'M',
		tireAge: 12,
		laps: 44,
		status: 'PIT',
		hasFastestLap: false,
		inDRS: false
	},
	{
		id: 'OCO',
		name: 'E. OCON',
		team: 'Alpine',
		position: 11,
		positionChange: 0,
		lastLap: '1:34.234',
		gap: '+32.123',
		interval: '+3.222',
		s1: '29.012',
		s2: '36.234',
		s3: '28.988',
		s1Status: 'yellow',
		s2Status: 'normal',
		s3Status: 'normal',
		tire: 'M',
		tireAge: 14,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: false
	},
	{
		id: 'TSU',
		name: 'Y. TSUNODA',
		team: 'RB',
		position: 12,
		positionChange: 0,
		lastLap: '1:34.345',
		gap: '+35.456',
		interval: '+3.333',
		s1: '29.123',
		s2: '36.234',
		s3: '28.988',
		s1Status: 'normal',
		s2Status: 'yellow',
		s3Status: 'yellow',
		tire: 'S',
		tireAge: 6,
		laps: 45,
		status: 'TRACK',
		hasFastestLap: false,
		inDRS: false
	}
];

/**
 * Table header configuration
 * Defines all columns with their display properties and sticky behavior
 */
export const HEADER_CONFIG: ColumnConfig[] = [
	{
		key: 'position',
		label: COLUMNS.position.label,
		width: COLUMNS.position.width,
		sticky: 'left',
		leftOffset: 0
	},
	{
		key: 'driver',
		label: COLUMNS.driver.label,
		width: COLUMNS.driver.width,
		sticky: 'left',
		leftOffset: COLUMNS.position.width
	},
	{
		key: 'lastLap',
		label: COLUMNS.lastLap.label,
		width: COLUMNS.lastLap.width
	},
	{
		key: 'gap',
		label: COLUMNS.gap.label,
		width: COLUMNS.gap.width
	},
	{
		key: 'interval',
		label: COLUMNS.interval.label,
		width: COLUMNS.interval.width
	},
	{
		key: 's1',
		label: COLUMNS.s1.label,
		width: COLUMNS.s1.width
	},
	{
		key: 's2',
		label: COLUMNS.s2.label,
		width: COLUMNS.s2.width
	},
	{
		key: 's3',
		label: COLUMNS.s3.label,
		width: COLUMNS.s3.width
	},
	{
		key: 'tire',
		label: COLUMNS.tire.label,
		width: COLUMNS.tire.width
	},
	{
		key: 'laps',
		label: COLUMNS.laps.label,
		width: COLUMNS.laps.width
	},
	{
		key: 'status',
		label: COLUMNS.status.label,
		width: COLUMNS.status.width
	},
	{
		key: 'actions',
		label: COLUMNS.actions.label,
		width: COLUMNS.actions.width,
		sticky: 'right'
	}
];
