import type { DriverRepository } from "../../../infra/db/repositories/driver.repository.js";
import type { DriverListEvent } from "../../../infra/f1-client/types/sync-events.types.js";
import { Driver } from "../../entities/Driver.js";

export function handleDriverList(driverRepository: DriverRepository) {
  return async (data: DriverListEvent) => {
    const drivers = await driverRepository.findAll();
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== "object") {
        continue;
      }

      if (drivers.some((driver) => driver.number === key)) {
        continue;
      }
      await driverRepository.create(
        Driver.create({
          name: `${value.FirstName} ${value.LastName}`,
          number: key,
          team: value.TeamName,
          avatarUrl: value.HeadshotUrl,
          shortName: value.Tla,
        }),
      );
    }
  };
}
