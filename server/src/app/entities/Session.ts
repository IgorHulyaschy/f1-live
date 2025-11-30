import { ulid } from "ulid";

export enum SessionType {
  RACE = "race",
  QUALIFYING = "qualifying",
  SPRINT = "sprint",
  SPRINT_QUALIFYING = "sprint_qualifying",
  PRACTICE = "practice",
}

type SessionCreation = {
  name: string;
  country: string;
  type: SessionType;
};

type SessionData = SessionCreation & {
  id: string;
  date: string;
};

export class Session {
  id: string;
  name: string;
  country: string;
  type: SessionType;
  date: string;

  constructor(data: SessionData) {
    this.id = data.id;
    this.name = data.name;
    this.country = data.country;
    this.type = data.type;
    this.date = data.date;
  }

  static create(data: SessionCreation): Session {
    return new Session({
      ...data,
      id: `session_${ulid()}`,
      date: new Date().toISOString().slice(0, 10),
    });
  }
}
