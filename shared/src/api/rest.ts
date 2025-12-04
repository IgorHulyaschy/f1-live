import type { Driver } from '../domain/driver';

export interface RaceSession {
  sessionId: string;
  sessionName: string;
  sessionType: 'race' | 'qualifying' | 'practice';
  currentLap: number;
  totalLaps: number;
  isLive: boolean;
  drivers: Driver[];
}

export interface SessionInfo {
  sessionId: string;
  sessionName: string;
  sessionType: 'race' | 'qualifying' | 'practice';
  trackName: string;
  startTime: string;
  isLive: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

export interface RestInfo {
  session: {
    id: string;
    name: string;
    country: string;
    type: string;
    date: Date;
  };
  driversLapsData: Array<Driver & { laps: any[] }>;
}
