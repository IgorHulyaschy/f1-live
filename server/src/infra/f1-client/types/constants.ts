export const Topic = {
	TIMING_DATA: 'TimingData',
	SESSION_INFO: 'SessionInfo',
	DRIVER_LIST: 'DriverList'
} as const;

export type Topic = (typeof Topic)[keyof typeof Topic];

export const SegmentStatus = {
	YELLOW: 2048,
	YELLOW_PERSONAL: 2049,
	/** Personal fastest. */
	GREEN: 2051,
	/** Overall fastest. */
	PURPLE: 2052,
	PIT: 2064
} as const;

export type SegmentStatus = (typeof SegmentStatus)[keyof typeof SegmentStatus];
