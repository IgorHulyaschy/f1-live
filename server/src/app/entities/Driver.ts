import { ulid } from "ulid";

type DriverCreation = {
  name: string;
  number: string;
  team: string;
  avatarUrl?: string;
  shortName: string;
};

type DriverData = DriverCreation & {
  id: string;
};

export class Driver {
  id: string;
  name: string;
  number: string;
  team: string;
  avatarUrl: string | null;
  shortName: string;

  constructor(data: DriverData) {
    this.id = data.id;
    this.name = data.name;
    this.number = data.number;
    this.team = data.team;
    this.avatarUrl = data.avatarUrl ?? null;
    this.shortName = data.shortName;
  }

  static create(data: DriverCreation): Driver {
    return new Driver({
      ...data,
      id: `driver_${ulid()}`,
    });
  }
}
