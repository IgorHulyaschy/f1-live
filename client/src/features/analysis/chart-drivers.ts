import type { Driver } from '@f1-live/shared';

import type { ChartConfig } from '@/components/ui/chart';

/** One chart series per driver, keyed by driver code, in team colour. */
export function driverChartConfig(drivers: readonly Driver[]): ChartConfig {
	return Object.fromEntries(
		drivers.map((driver) => [driver.code, { label: driver.code, color: `#${driver.teamColour}` }])
	);
}

/** Teammates share a colour; dash the second car of a team so the lines stay distinguishable. */
export function isSecondTeamCar(driver: Driver, drivers: readonly Driver[]): boolean {
	return (
		drivers.findIndex((candidate) => candidate.team === driver.team) !== drivers.indexOf(driver)
	);
}
