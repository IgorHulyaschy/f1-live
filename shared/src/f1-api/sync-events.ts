export interface DriverListEvent {
  [key: string]: {
    FirstName: string;
    LastName: string;
    HeadshotUrl: string;
    TeamName: string;
    Tla: string;
  };
}

export interface SessionEvent {
  Meeting: {
    Name: string;
    Country: {
      Code: string;
    };
  };
  Name: 'Race' | 'Qualifying' | 'Sprint' | 'Sprint Qualifying' | 'Practice';
  StartDate: string;
}

export type LiveSessionInfoEvent = SessionEvent;
