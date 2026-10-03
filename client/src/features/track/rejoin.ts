export type RoadCar = { driverNumber: string; progress: number };

export type Rejoin = {
	/** The place the car would hold on the road, counting cars by how far round they are. */
	position: number;
	ahead: RoadCar | null;
	behind: RoadCar | null;
};

/**
 * Where a car `ghostProgress` round the lap rejoins among `cars`: the cars further round are
 * ahead of it. The car itself is left out.
 */
export function rejoinAmong(
	cars: readonly RoadCar[],
	driverNumber: string,
	ghostProgress: number
): Rejoin {
	let ahead: RoadCar | null = null;
	let behind: RoadCar | null = null;
	let position = 1;

	for (const car of cars) {
		if (car.driverNumber === driverNumber || !Number.isFinite(car.progress)) {
			continue;
		}

		if (car.progress > ghostProgress) {
			position++;

			if (!ahead || car.progress < ahead.progress) {
				ahead = car;
			}
		} else if (!behind || car.progress > behind.progress) {
			behind = car;
		}
	}

	return { position, ahead, behind };
}
