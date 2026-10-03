/**
 * Reference data from the 2025 Las Vegas Grand Prix race, taken from the live timing feed
 * snapshots in server/data-examples (TimingAppData, TimingData, RaceControlMessages, WeatherData).
 * Classification is as published at the chequered flag, before later steward decisions.
 */

import type { RaceControlCategory, TyreCompound } from '@f1-live/shared';

export interface ReferenceStint {
	compound: TyreCompound;
	laps: number;
}

export interface ReferenceResult {
	driverNumber: string;
	grid: number;
	stints: readonly ReferenceStint[];
	lapsCompleted: number;
	/** Gap to the winner in seconds at the flag; null when lapped or retired. */
	gapSeconds: number | null;
	/** Interval to the car ahead in seconds at the flag; null when unavailable. */
	intervalSeconds: number | null;
	retired: boolean;
}

export const REFERENCE_TOTAL_LAPS = 50;

export const REFERENCE_RESULTS: readonly ReferenceResult[] = [
	{
		driverNumber: '1',
		grid: 2,
		stints: [
			{ compound: 'MEDIUM', laps: 25 },
			{ compound: 'HARD', laps: 25 }
		],
		lapsCompleted: 50,
		gapSeconds: 0,
		intervalSeconds: 0,
		retired: false
	},
	{
		driverNumber: '4',
		grid: 1,
		stints: [
			{ compound: 'MEDIUM', laps: 22 },
			{ compound: 'HARD', laps: 28 }
		],
		lapsCompleted: 50,
		gapSeconds: 20.741,
		intervalSeconds: 20.741,
		retired: false
	},
	{
		driverNumber: '63',
		grid: 4,
		stints: [
			{ compound: 'MEDIUM', laps: 17 },
			{ compound: 'HARD', laps: 33 },
			{ compound: 'HARD', laps: 1 }
		],
		lapsCompleted: 50,
		gapSeconds: 23.546,
		intervalSeconds: 2.805,
		retired: false
	},
	{
		driverNumber: '81',
		grid: 5,
		stints: [
			{ compound: 'MEDIUM', laps: 21 },
			{ compound: 'HARD', laps: 29 }
		],
		lapsCompleted: 50,
		gapSeconds: 27.65,
		intervalSeconds: 4.104,
		retired: false
	},
	{
		driverNumber: '12',
		grid: 17,
		stints: [
			{ compound: 'SOFT', laps: 2 },
			{ compound: 'HARD', laps: 48 }
		],
		lapsCompleted: 50,
		gapSeconds: 30.488,
		intervalSeconds: 2.838,
		retired: false
	},
	{
		driverNumber: '16',
		grid: 9,
		stints: [
			{ compound: 'MEDIUM', laps: 24 },
			{ compound: 'HARD', laps: 26 }
		],
		lapsCompleted: 50,
		gapSeconds: 30.678,
		intervalSeconds: 0.19,
		retired: false
	},
	{
		driverNumber: '55',
		grid: 3,
		stints: [
			{ compound: 'MEDIUM', laps: 22 },
			{ compound: 'HARD', laps: 28 }
		],
		lapsCompleted: 50,
		gapSeconds: 34.924,
		intervalSeconds: 4.246,
		retired: false
	},
	{
		driverNumber: '6',
		grid: 8,
		stints: [
			{ compound: 'MEDIUM', laps: 20 },
			{ compound: 'HARD', laps: 30 }
		],
		lapsCompleted: 50,
		gapSeconds: 45.257,
		intervalSeconds: 10.333,
		retired: false
	},
	{
		driverNumber: '27',
		grid: 11,
		stints: [
			{ compound: 'HARD', laps: 30 },
			{ compound: 'MEDIUM', laps: 20 }
		],
		lapsCompleted: 50,
		gapSeconds: 51.134,
		intervalSeconds: 5.877,
		retired: false
	},
	{
		driverNumber: '44',
		grid: 19,
		stints: [
			{ compound: 'HARD', laps: 29 },
			{ compound: 'MEDIUM', laps: 21 }
		],
		lapsCompleted: 50,
		gapSeconds: 59.369,
		intervalSeconds: 8.235,
		retired: false
	},
	{
		driverNumber: '31',
		grid: 13,
		stints: [
			{ compound: 'MEDIUM', laps: 27 },
			{ compound: 'HARD', laps: 23 }
		],
		lapsCompleted: 50,
		gapSeconds: 60.635,
		intervalSeconds: 1.266,
		retired: false
	},
	{
		driverNumber: '87',
		grid: 14,
		stints: [
			{ compound: 'MEDIUM', laps: 17 },
			{ compound: 'HARD', laps: 33 }
		],
		lapsCompleted: 50,
		gapSeconds: 70.549,
		intervalSeconds: 9.914,
		retired: false
	},
	{
		driverNumber: '14',
		grid: 7,
		stints: [
			{ compound: 'MEDIUM', laps: 16 },
			{ compound: 'HARD', laps: 34 }
		],
		lapsCompleted: 50,
		gapSeconds: 85.308,
		intervalSeconds: 14.759,
		retired: false
	},
	{
		driverNumber: '22',
		grid: 20,
		stints: [
			{ compound: 'MEDIUM', laps: 1 },
			{ compound: 'HARD', laps: 26 },
			{ compound: 'MEDIUM', laps: 24 }
		],
		lapsCompleted: 50,
		gapSeconds: 86.974,
		intervalSeconds: 1.666,
		retired: false
	},
	{
		driverNumber: '10',
		grid: 10,
		stints: [
			{ compound: 'MEDIUM', laps: 2 },
			{ compound: 'HARD', laps: 48 }
		],
		lapsCompleted: 50,
		gapSeconds: 91.702,
		intervalSeconds: 4.728,
		retired: false
	},
	{
		driverNumber: '30',
		grid: 6,
		stints: [
			{ compound: 'MEDIUM', laps: 2 },
			{ compound: 'HARD', laps: 26 },
			{ compound: 'HARD', laps: 21 }
		],
		lapsCompleted: 49,
		gapSeconds: null,
		intervalSeconds: 7.319,
		retired: false
	},
	{
		driverNumber: '43',
		grid: 15,
		stints: [
			{ compound: 'HARD', laps: 25 },
			{ compound: 'MEDIUM', laps: 24 }
		],
		lapsCompleted: 49,
		gapSeconds: null,
		intervalSeconds: 7.168,
		retired: false
	},
	{
		driverNumber: '23',
		grid: 16,
		stints: [
			{ compound: 'HARD', laps: 13 },
			{ compound: 'MEDIUM', laps: 1 },
			{ compound: 'HARD', laps: 20 },
			{ compound: 'MEDIUM', laps: 2 }
		],
		lapsCompleted: 35,
		gapSeconds: null,
		intervalSeconds: null,
		retired: true
	},
	{
		driverNumber: '5',
		grid: 18,
		stints: [
			{ compound: 'HARD', laps: 1 },
			{ compound: 'MEDIUM', laps: 1 }
		],
		lapsCompleted: 2,
		gapSeconds: null,
		intervalSeconds: null,
		retired: true
	},
	{
		driverNumber: '18',
		grid: 12,
		stints: [],
		lapsCompleted: 0,
		gapSeconds: null,
		intervalSeconds: null,
		retired: true
	}
];

export interface ReferenceRaceControlMessage {
	lap: number;
	category: RaceControlCategory;
	message: string;
}

export const REFERENCE_RACE_CONTROL: readonly ReferenceRaceControlMessage[] = [
	{ lap: 1, category: 'flag', message: 'GREEN LIGHT - PIT EXIT OPEN' },
	{ lap: 1, category: 'other', message: 'PIT EXIT CLOSED' },
	{
		lap: 1,
		category: 'incident',
		message:
			'FIA STEWARDS: INCIDENT INVOLVING CAR 4 (NOR) NOTED - FAILING TO FOLLOW RACE DIRECTORS INSTRUCTIONS - MAXIMUM DELTA TIME'
	},
	{ lap: 1, category: 'flag', message: 'DOUBLE YELLOW IN TRACK SECTOR 3' },
	{ lap: 1, category: 'drs', message: 'DRS DISABLED IN ZONE 1' },
	{
		lap: 1,
		category: 'incident',
		message:
			'FIA STEWARDS: INCIDENT INVOLVING CAR 4 (NOR) WILL BE INVESTIGATED AFTER THE RACE - FAILING TO FOLLOW RACE DIRECTORS INSTRUCTIONS - MAXIMUM DELTA TIME'
	},
	{ lap: 1, category: 'drs', message: 'DRS ENABLED IN ZONE 1' },
	{ lap: 1, category: 'flag', message: 'CLEAR IN TRACK SECTOR 3' },
	{ lap: 1, category: 'other', message: 'RISK OF RAIN FOR F1 RACE IS 10 %' },
	{
		lap: 1,
		category: 'incident',
		message:
			'FIA STEWARDS: INCIDENT INVOLVING CAR 4 (NOR) NO FURTHER ACTION - FAILING TO FOLLOW RACE DIRECTORS INSTRUCTIONS - MAXIMUM DELTA TIME'
	},
	{ lap: 1, category: 'drs', message: 'DRS DISABLED' },
	{ lap: 1, category: 'flag', message: 'GREEN LIGHT - PIT EXIT OPEN' },
	{ lap: 1, category: 'flag', message: 'YELLOW IN TRACK SECTOR 2' },
	{ lap: 1, category: 'flag', message: 'DOUBLE YELLOW IN TRACK SECTOR 2' },
	{ lap: 1, category: 'flag', message: 'CLEAR IN TRACK SECTOR 2' },
	{ lap: 1, category: 'other', message: 'TRACK SURFACE SLIPPERY IN TRACK SECTOR 3' },
	{ lap: 1, category: 'other', message: 'TRACK SURFACE SLIPPERY IN TRACK SECTOR 4' },
	{ lap: 1, category: 'other', message: 'TRACK SURFACE SLIPPERY IN TRACK SECTOR 2' },
	{ lap: 1, category: 'flag', message: 'DOUBLE YELLOW IN TRACK SECTOR 2' },
	{ lap: 1, category: 'flag', message: 'CLEAR IN TRACK SECTOR 4' },
	{ lap: 1, category: 'drs', message: 'DRS ENABLED' },
	{ lap: 2, category: 'flag', message: 'CLEAR IN TRACK SECTOR 2' },
	{ lap: 2, category: 'flag', message: 'DOUBLE YELLOW IN TRACK SECTOR 2' },
	{ lap: 2, category: 'safety_car', message: 'VIRTUAL SAFETY CAR DEPLOYED' },
	{ lap: 2, category: 'flag', message: 'CLEAR IN TRACK SECTOR 3' },
	{ lap: 2, category: 'flag', message: 'DOUBLE YELLOW IN TRACK SECTOR 3' },
	{
		lap: 3,
		category: 'incident',
		message: 'TURN 1 INCIDENT INVOLVING CARS 81 (PIA) AND 30 (LAW) NOTED - CAUSING A COLLISION'
	},
	{
		lap: 3,
		category: 'incident',
		message:
			'FIA STEWARDS: TURN 1 INCIDENT INVOLVING CARS 81 (PIA) AND 30 (LAW) UNDER INVESTIGATION - CAUSING A COLLISION'
	},
	{ lap: 3, category: 'flag', message: 'CLEAR IN TRACK SECTOR 2' },
	{ lap: 3, category: 'flag', message: 'CLEAR IN TRACK SECTOR 3' },
	{ lap: 4, category: 'safety_car', message: 'VIRTUAL SAFETY CAR ENDING' },
	{ lap: 4, category: 'flag', message: 'TRACK CLEAR' },
	{ lap: 4, category: 'drs', message: 'DRS ENABLED' },
	{
		lap: 4,
		category: 'incident',
		message:
			'TURN 1 INCIDENT INVOLVING CARS 5 (BOR), 43 (COL) AND 18 (STR) NOTED - CAUSING A COLLISION'
	},
	{
		lap: 5,
		category: 'incident',
		message:
			'FIA STEWARDS: TURN 1 INCIDENT INVOLVING CARS 5 (BOR) AND 18 (STR) UNDER INVESTIGATION - CAUSING A COLLISION'
	},
	{
		lap: 7,
		category: 'incident',
		message:
			'FIA STEWARDS: TURN 1 INCIDENT INVOLVING CARS 81 (PIA) AND 30 (LAW) NO FURTHER ACTION - CAUSING A COLLISION'
	},
	{
		lap: 9,
		category: 'incident',
		message:
			'FIA STEWARDS: TURN 1 INCIDENT INVOLVING CARS 5 (BOR) AND 18 (STR) WILL BE INVESTIGATED AFTER THE RACE - CAUSING A COLLISION'
	},
	{
		lap: 9,
		category: 'incident',
		message: 'INCIDENT INVOLVING CAR 12 (ANT) NOTED - FALSE START - MOVING BEFORE SIGNAL'
	},
	{
		lap: 10,
		category: 'incident',
		message: 'INCIDENT INVOLVING CAR 23 (ALB) NOTED - STARTING PROCEDURE INFRINGEMENT'
	},
	{
		lap: 11,
		category: 'incident',
		message:
			'FIA STEWARDS: INCIDENT INVOLVING CAR 12 (ANT) UNDER INVESTIGATION - FALSE START - MOVING BEFORE SIGNAL'
	},
	{ lap: 14, category: 'other', message: 'TRACK SURFACE SLIPPERY IN TRACK SECTOR 17' },
	{
		lap: 15,
		category: 'penalty',
		message:
			'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 12 (ANT) - FALSE START - MOVING BEFORE SIGNAL'
	},
	{
		lap: 15,
		category: 'incident',
		message: 'TURN 14 INCIDENT INVOLVING CARS 23 (ALB) AND 44 (HAM) NOTED - CAUSING A COLLISION'
	},
	{ lap: 16, category: 'safety_car', message: 'VIRTUAL SAFETY CAR DEPLOYED' },
	{ lap: 16, category: 'flag', message: 'CLEAR IN TRACK SECTOR 17' },
	{ lap: 16, category: 'flag', message: 'DOUBLE YELLOW IN TRACK SECTOR 17' },
	{ lap: 16, category: 'flag', message: 'CLEAR IN TRACK SECTOR 17' },
	{ lap: 16, category: 'safety_car', message: 'VIRTUAL SAFETY CAR ENDING' },
	{
		lap: 16,
		category: 'incident',
		message:
			'FIA STEWARDS: TURN 14 INCIDENT INVOLVING CARS 23 (ALB) AND 44 (HAM) UNDER INVESTIGATION - CAUSING A COLLISION'
	},
	{ lap: 16, category: 'flag', message: 'TRACK CLEAR' },
	{ lap: 16, category: 'drs', message: 'DRS ENABLED' },
	{
		lap: 19,
		category: 'incident',
		message:
			'FIA STEWARDS: INCIDENT INVOLVING CAR 23 (ALB) UNDER INVESTIGATION - STARTING PROCEDURE INFRINGEMENT'
	},
	{
		lap: 20,
		category: 'penalty',
		message: 'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 23 (ALB) - CAUSING A COLLISION'
	},
	{
		lap: 21,
		category: 'penalty',
		message: 'FIA STEWARDS: REPRIMAND (DRIVING) FOR CAR 23 (ALB) - STARTING PROCEDURE INFRINGEMENT'
	},
	{ lap: 36, category: 'flag', message: 'WAVED BLUE FLAG FOR CAR 23 (ALB) TIMED AT 21:02:02' },
	{ lap: 36, category: 'flag', message: 'WAVED BLUE FLAG FOR CAR 23 (ALB) TIMED AT 21:02:09' },
	{
		lap: 37,
		category: 'penalty',
		message:
			'FIA STEWARDS: PENALTY SERVED - 5 SECOND TIME PENALTY FOR CAR 23 (ALB) - CAUSING A COLLISION'
	},
	{ lap: 45, category: 'flag', message: 'WAVED BLUE FLAG FOR CAR 43 (COL) TIMED AT 21:17:21' },
	{ lap: 49, category: 'flag', message: 'WAVED BLUE FLAG FOR CAR 30 (LAW) TIMED AT 21:22:21' },
	{ lap: 50, category: 'flag', message: 'CHEQUERED FLAG' },
	{ lap: 50, category: 'other', message: 'ALL PASS HOLDERS MAY ACCESS THE PIT LANE' }
];

/** WeatherData at the start of the race. */
export const REFERENCE_WEATHER = {
	airTempC: 16.3,
	trackTempC: 16.7,
	humidityPct: 39,
	windSpeedMs: 2.3
} as const;

export const REFERENCE_SESSION = {
	id: 'replay-2025-las-vegas-race',
	meetingName: 'Las Vegas Grand Prix',
	circuit: 'Las Vegas',
	countryCode: 'USA',
	type: 'race',
	totalLaps: REFERENCE_TOTAL_LAPS,
	startsAt: '2025-11-23T04:00:00Z'
} as const;

/**
 * The championship before the race, from the timing feed's ChampionshipPrediction: points and place
 * per car and per team (Norris 390, Piastri 366, Verstappen 341).
 */
export const REFERENCE_CHAMPIONSHIP = {
	drivers: [
		['4', 390],
		['81', 366],
		['1', 341],
		['63', 276],
		['16', 214],
		['44', 148],
		['12', 122],
		['23', 73],
		['27', 43],
		['6', 43],
		['87', 40],
		['14', 40],
		['55', 38],
		['30', 36],
		['18', 32],
		['31', 30],
		['22', 28],
		['10', 22],
		['5', 19],
		['43', 0]
	],
	teams: [
		['McLaren', 756],
		['Mercedes', 398],
		['Red Bull Racing', 366],
		['Ferrari', 362],
		['Williams', 111],
		['Racing Bulls', 82],
		['Aston Martin', 72],
		['Haas F1 Team', 70],
		['Kick Sauber', 62],
		['Alpine', 22]
	]
} as const satisfies {
	drivers: readonly (readonly [string, number])[];
	teams: readonly (readonly [string, number])[];
};
