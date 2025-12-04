import { SegmentStatus } from './constants';

export type SectorData =
  | {
      Value: string;
      PersonalFastest?: boolean;
    }
  | {
      Segments: {
        [key: string]: {
          Status: SegmentStatus;
        };
      };
    }
  | {
      PreviousValue: string;
    };

export interface LiveTimingDataEvent {
  Lines?: {
    [driverNumber: string]: {
      Sectors?: {
        [sectorNumber: string]: SectorData;
      };
      LastLapTime?: {
        Value: string;
      };
      Speeds?: {
        [key: string]: any;
      };
      NumberOfLaps?: number;
    };
  };
}
