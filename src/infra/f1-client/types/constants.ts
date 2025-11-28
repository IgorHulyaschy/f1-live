export enum Topic {
  TIMING_DATA = "TimingData",
  SESSION_INFO = "SessionInfo",
  DRIVER_LIST = "DriverList",
}

export enum SegmentStatus {
  YELLOW = 2048,
  YELLOW_PERSONAL = 2049,
  GREEN = 2051, // personal fastest
  PURPLE = 2052, // overall fastest
  PIT = 2064, // pit stop
}
