import type { DriverRepository } from '../../../infra/db/repositories/driver.repository.js';
import type { DriverListEvent } from '../../../infra/f1-client/types/sync-events.types.js';
import { Driver } from '../../entities/Driver.js';

export function handleDriverList(driverRepository: DriverRepository) {
	return async (data: DriverListEvent) => {
		const knownNumbers = new Set((await driverRepository.findAll()).map((driver) => driver.number));
		const newDrivers: Driver[] = [];

		for (const [number, entry] of Object.entries(data)) {
			// Non-driver keys such as `_kf` carry booleans.
			if (entry === true || entry === false || knownNumbers.has(number)) {
				continue;
			}

			newDrivers.push(
				Driver.create({
					name: `${entry.FirstName} ${entry.LastName}`,
					number,
					team: entry.TeamName,
					avatarUrl: entry.HeadshotUrl,
					shortName: entry.Tla
				})
			);
		}

		await Promise.all(newDrivers.map((driver) => driverRepository.create(driver)));
	};
}
