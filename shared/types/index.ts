export type Lap = {
  id: string;
  driverNumber: string;
  lapNumber: number;
  sector1Time?: number | null;
  sector2Time?: number | null;
  sector3Time?: number | null;
  time?: number | null;
  sessionId: string;
};

export type Driver = {
  id: string;
  name: string;
  number: number;
  team: string;
  avatarUrl?: string | null;
  shortName: string;
};

export enum SessionType {
  RACE = "race",
  QUALIFYING = "qualifying",
  SPRINT = "sprint",
  SPRINT_QUALIFYING = "sprint_qualifying",
  PRACTICE = "practice",
}

export type Session = {
  id: string;
  name: string;
  country: string;
  type: SessionType;
  data: Date;
};

export type RestInfo = {
  session: Session;
  driversLapsData: Driver & { laps: Lap[] }[];
};
