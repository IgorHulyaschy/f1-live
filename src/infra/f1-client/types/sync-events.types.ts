import type { Topic } from "./constants.js";

export type CallbackByTopic = {
  [Topic.SESSION_INFO]: (data: SessionEvent) => void;
  [Topic.TIMING_DATA]: never;
  [Topic.DRIVER_LIST]: (data: DriverListEvent) => void;
};

export type CallBackMap<TTopic extends Topic = Topic> = Record<
  TTopic,
  CallbackByTopic[TTopic]
>;

export type EventData = {
  [Topic.SESSION_INFO]: SessionEvent;
  [Topic.TIMING_DATA]: never;
  [Topic.DRIVER_LIST]: DriverListEvent;
};

export type DriverListEvent = {
  // Driver number
  [key: string]: {
    FirstName: string;
    LastName: string;
    HeadshotUrl: string;
    TeamName: string;
  };
};

export type SessionEvent = {
  Meeting: {
    Name: string;
    Country: {
      Code: string;
    };
  };
  Name: "Race" | "Qualifying" | "Sprint" | "Sprint Qualifying" | "Practice";
  StartDate: string;
};
