export enum SessionType {
  RACE = 'race',
  QUALIFYING = 'qualifying',
  SPRINT = 'sprint',
  SPRINT_QUALIFYING = 'sprint_qualifying',
  PRACTICE = 'practice',
}

export interface Session {
  id: string;
  name: string;
  country: string;
  type: SessionType;
  date: string;
}
