import { ulid } from "ulid";

type DriverCreation = {
  name: string;
  number: string;
  team: string;
  avatarUrl?: string;
}

type DriverData = DriverCreation & {
  id: string;
}

export class Driver {
  id: string;
  name: string;
  number: string;
  team: string;
  avatarUrl: string | null;

  constructor(data: DriverData) {
    this.id = data.id;
    this.name = data.name;
    this.number = data.number;
    this.team = data.team;
    this.avatarUrl = data.avatarUrl ?? null;
  }

  static create(data: DriverCreation): Driver {
    return new Driver({
      ...data,
      id: `driver_${ulid()}`,
    });
  }
}