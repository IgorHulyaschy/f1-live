export interface Lap {
  id: string;
  driverNumber: string;
  lapNumber: number;
  sector1Time: number | null;
  sector2Time: number | null;
  sector3Time: number | null;
  time: number | null;
  sessionId: string;
}
