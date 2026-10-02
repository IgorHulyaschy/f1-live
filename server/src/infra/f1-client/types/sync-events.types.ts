import type { Topic } from './constants.js';

export type DriverListEntry = {
	FirstName: string;
	LastName: string;
	HeadshotUrl: string;
	TeamName: string;
	Tla: string;
};

/**
 * Keyed by racing number. The snapshot also carries non-driver keys such as `_kf`,
 * whose values are not objects.
 */
export type DriverListEvent = Record<string, DriverListEntry | boolean>;

export type SessionEvent = {
	Meeting: {
		Name: string;
		Country: {
			Code: string;
		};
	};
	Name:
		| 'Race'
		| 'Qualifying'
		| 'Sprint'
		| 'Sprint Qualifying'
		| 'Practice'
		| 'Practice 2'
		| 'Practice 3';
	StartDate: string;
};

export type SnapshotHandlers = {
	[Topic.SESSION_INFO]: (data: SessionEvent) => Promise<void>;
	[Topic.DRIVER_LIST]: (data: DriverListEvent) => Promise<void>;
};
