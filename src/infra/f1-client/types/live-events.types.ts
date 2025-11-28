/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SegmentStatus, Topic } from "./constants.js";

export type LiveEvent<TTopic extends Topic = Topic> = [
  TTopic,
  LiveEventData[TTopic],
  string // data of chunk with their timezone
];

export type LiveEventData = {
  [Topic.TIMING_DATA]: LiveTimingDataEvent;
  [Topic.SESSION_INFO]: never;
  [Topic.DRIVER_LIST]: never;
};

export type SectorData =
  | {
      Value: string; // secs or empty string
      PersonalFastest: boolean;
    }
  | {
      Segments: {
        [key: string]: {
          Status: SegmentStatus;
        };
      };
    } | {
      PreviousValue: string; // secs
    };

export type LiveTimingDataEvent = {
  Lines: {
    // number of driver
    [key: string]: {
      Sectors: {
        // number of sector starts from 0
        [key: string]: SectorData;
      };
    };
  } | ForNowUselessType1;
};

type ForNowUselessType1 = {
  Speeds: any;
};
