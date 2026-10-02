import type { SegmentStatus, Topic } from './constants.js';
import type { DriverListEvent, SessionEvent } from './sync-events.types.js';

export type LiveEventData = {
	[Topic.TIMING_DATA]: LiveTimingDataEvent;
	[Topic.SESSION_INFO]: SessionEvent;
	[Topic.DRIVER_LIST]: DriverListEvent;
};

/** A `feed` invocation from the SignalR hub: topic, partial payload, and the feed's own timestamp. */
export type LiveEvent = {
	[TTopic in Topic]: [TTopic, LiveEventData[TTopic], string];
}[Topic];

export type SectorData =
	| {
			/** Seconds, or an empty string while the sector is running. */
			Value: string;
			PersonalFastest: boolean;
	  }
	| {
			Segments: Record<string, { Status: SegmentStatus }>;
	  }
	| {
			/** Seconds. */
			PreviousValue: string;
	  };

export type TimingDataLine = {
	/** Keyed by sector index, starting from "0". */
	Sectors?: Record<string, SectorData>;
	LastLapTime?: {
		/** "m:ss.SSS". */
		Value: string;
	};
	/** Completed laps; present in races and sprints only. */
	NumberOfLaps?: number;
};

export type LiveTimingDataEvent = {
	/** Keyed by racing number. */
	Lines?: Record<string, TimingDataLine>;
};
