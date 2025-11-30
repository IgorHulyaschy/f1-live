import { ulid } from "ulid";

type LapCreation = {
  driverNumber: string;
  lapNumber: number;
  sessionId: string;
};

type LapData = {
  id: string;
  driverNumber: string;
  lapNumber: number;
  sector1Time?: number | null;
  sector2Time?: number | null;
  sector3Time?: number | null;
  time?: number | null;
  sessionId: string;
};

export class Lap {
  id: string;
  driverNumber: string;
  lapNumber: number;
  sector1Time: number | null;
  sector2Time: number | null;
  sector3Time: number | null;
  time: number | null;
  sessionId: string;
  constructor(data: LapData) {
    this.id = data.id;
    this.driverNumber = data.driverNumber;
    this.lapNumber = data.lapNumber;
    this.sector1Time = data.sector1Time ?? null;
    this.sector2Time = data.sector2Time ?? null;
    this.sector3Time = data.sector3Time ?? null;
    this.time = data.time ?? null;
    this.sessionId = data.sessionId;
  }

  static create(data: LapCreation): Lap {
    return new Lap({
      ...data,
      id: `lap_${ulid()}`,
      lapNumber: data.lapNumber || 1,
    });
  }
}
