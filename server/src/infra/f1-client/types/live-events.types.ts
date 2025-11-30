/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SegmentStatus, Topic } from "./constants.js";

export type LiveEvent<TTopic extends Topic> = [
  TTopic,
  LiveEventData[TTopic],
  string, // data of chunk with their timezone
];

export type LiveEventData = {
  [Topic.TIMING_DATA]: LiveTimingDataEvent;
  [Topic.SESSION_INFO]: LiveSessionInfoEvent;
  [Topic.DRIVER_LIST]: unknown;
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
    }
  | {
      PreviousValue: string; // secs
    };

type LiveTimingDataEvent = {
  Lines: {
    // number of driver
    [key: string]: {
      Sectors?: {
        // number of sector starts from 0
        [key: string]: SectorData;
      };
      LastLapTime?: {
        Value: string; // mins
      };
      Speeds?: {
        [key: string]: any;
      };
      // completed lap number, can be present on sprint race or race
      NumberOfLaps?: number;
    };
  };
};

type LiveSessionInfoEvent = {
  Meeting: {
    Name: string;
    Country: {
      Code: string;
    };
  };
  Name: "Race" | "Qualifying" | "Sprint" | "Sprint Qualifying" | "Practice";
  StartDate: string;
};
