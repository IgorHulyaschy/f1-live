import type { AskInsight, Subject } from '@f1-live/shared/ask';
import type { Driver, RaceSnapshot, Stint, TyreCompound } from '@f1-live/shared';
import { driverIdOf } from '@f1-live/shared/results';

import { crewLeague } from '../../insights/pit-cost.ts';
import { bestSectors } from '../../insights/sectors.ts';
import { countedLaps } from '../../insights/standings.ts';
import { teamIdOf } from '../../insights/teams.ts';
import { formatGap, formatLapTime, formatSectorTime } from '../../lib/format.ts';
import { labelOf } from './ask-context.ts';
import {
	type AskData,
	type AskSessionInfo,
	plural,
	sessionHref,
	sessionLabel
} from './ask-data.ts';
import type { AskOutcome, TableRow } from './answers.ts';

const COMPOUND_NAME: Record<TyreCompound, string> = {
	SOFT: 'Soft',
	MEDIUM: 'Medium',
	HARD: 'Hard',
	INTERMEDIATE: 'Intermediate',
	WET: 'Wet',
	UNKNOWN: 'Unknown'
};

const STOPS_NAME = ['No-stop', 'One-stop', 'Two-stop', 'Three-stop'];

function isMine(subject: Subject | null, driver: Driver): boolean {
	return (
		subject === null ||
		(subject.kind === 'driver'
			? driverIdOf(driver.firstName, driver.lastName) === subject.id
			: teamIdOf(driver.team) === subject.id)
	);
}

/** Drivers by the order they finished or were classified in, when the data has one. */
function inOrder(snapshot: RaceSnapshot): Driver[] {
	const place = new Map(
		snapshot.standings?.map((standing) => [standing.driverNumber, standing.position])
	);

	return snapshot.drivers.toSorted(
		(a, b) => (place.get(a.number) ?? 99) - (place.get(b.number) ?? 99)
	);
}

function stintText(stints: readonly Stint[]): string {
	return stints
		.map((stint) => `${COMPOUND_NAME[stint.compound]} ${stint.startLap}–${stint.endLap}`)
		.join(', ');
}

/** A reading of one session's saved data, linking each number to the lap or view it shows. */
export function insightAnswer(
	data: AskData,
	info: AskSessionInfo,
	insight: AskInsight,
	subject: Subject | null,
	snapshot: RaceSnapshot
): AskOutcome {
	const label = sessionLabel(info);
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const mine = snapshot.drivers.filter((driver) => isMine(subject, driver));
	const subjectName = subject ? labelOf(data.context, subject.kind, subject.id) : null;

	if (subject && mine.length === 0) {
		return { kind: 'missing', message: `${subjectName} did not take part in the ${label}.` };
	}

	const car = (driver: Driver, lap?: number) => ({
		text: driver.lastName,
		href: sessionHref(info.key, driver.number, lap)
	});

	const base = { kind: 'answer' as const, hidden: [] };

	switch (insight) {
		case 'fastest_lap': {
			const best = new Map<string, { ms: number; lap: number }>();

			for (const lap of countedLaps(snapshot)) {
				const known = best.get(lap.driverNumber);

				if (lap.lapTimeMs > 0 && (!known || lap.lapTimeMs < known.ms)) {
					best.set(lap.driverNumber, { ms: lap.lapTimeMs, lap: lap.lap });
				}
			}

			const ranked = [...best.entries()]
				.flatMap(([number, lap]) => {
					const driver = drivers.get(number);

					return driver ? [{ driver, ...lap }] : [];
				})
				.toSorted((a, b) => a.ms - b.ms);

			const top = ranked[0];
			const own = ranked.find((entry) => subject !== null && isMine(subject, entry.driver));

			if (!top || (subject && !own)) {
				return {
					kind: 'missing',
					message: `No timed lap in the ${label}${subject ? ` for ${subjectName}` : ''}.`
				};
			}

			const shown = own ?? top;
			const rank = ranked.indexOf(shown) + 1;

			const rows: TableRow[] = ranked.slice(0, 5).map((entry, index) => ({
				cells: [
					String(index + 1),
					entry.driver.lastName,
					formatLapTime(entry.ms),
					`Lap ${entry.lap}`
				],
				href: sessionHref(info.key, entry.driver.number, entry.lap),
				colour: entry.driver.teamColour,
				mark: entry === own
			}));

			if (own && rank > 5) {
				rows.push({
					cells: [String(rank), own.driver.lastName, formatLapTime(own.ms), `Lap ${own.lap}`],
					href: sessionHref(info.key, own.driver.number, own.lap),
					colour: own.driver.teamColour,
					mark: true
				});
			}

			return {
				...base,
				headline: own
					? [
							car(own.driver, own.lap),
							`'s best lap in the ${label}: `,
							{
								text: formatLapTime(own.ms),
								href: sessionHref(info.key, own.driver.number, own.lap)
							},
							rank === 1 ? ', the fastest of all' : `, P${rank}`
						]
					: [
							car(top.driver, top.lap),
							` set the fastest lap of the ${label}: `,
							{
								text: formatLapTime(top.ms),
								href: sessionHref(info.key, top.driver.number, top.lap)
							},
							` on lap ${top.lap}`
						],
				detail:
					own && rank > 1
						? [`${formatGap(own.ms - top.ms)} off `, car(top.driver, top.lap), '.']
						: null,
				visual: { kind: 'table', columns: ['Pos', 'Driver', 'Time', 'Lap'], rows },
				source: `${label}, ${plural(countedLaps(snapshot).length, 'timed lap')}`,
				proof: {
					label: 'Open the lap',
					href: sessionHref(info.key, shown.driver.number, shown.lap)
				}
			};
		}

		case 'top_speed': {
			const speeds = (snapshot.personalBests ?? [])
				.flatMap((best) => {
					const driver = drivers.get(best.driverNumber);
					const kph = best.topSpeedsKph.speedTrap;

					return driver && kph ? [{ driver, kph }] : [];
				})
				.toSorted((a, b) => b.kph - a.kph);

			const top = speeds[0];
			const own = subject ? speeds.find((entry) => isMine(subject, entry.driver)) : undefined;

			if (!top || (subject && !own)) {
				return { kind: 'missing', message: `The ${label} has no speed-trap readings.` };
			}

			const shown = own ?? top;

			return {
				...base,
				headline: [
					car(shown.driver),
					own && own !== top
						? ` reached `
						: ` was quickest through the speed trap at the ${label}: `,
					{ text: `${shown.kph} km/h`, href: sessionHref(info.key, shown.driver.number) },
					own && own !== top ? ` through the speed trap, P${speeds.indexOf(own) + 1}` : ''
				],
				detail: own && own !== top ? ['Quickest: ', car(top.driver), ` at ${top.kph} km/h.`] : null,
				visual: {
					kind: 'bars',
					bars: speeds.slice(0, 8).map((entry) => ({
						label: entry.driver.lastName,
						value: entry.kph,
						display: `${entry.kph}`,
						href: sessionHref(info.key, entry.driver.number),
						colour: entry.driver.teamColour
					}))
				},
				source: `${label}, speed trap, km/h`,
				proof: { label: 'Open the session', href: sessionHref(info.key, shown.driver.number) }
			};
		}

		case 'tyres': {
			const byDriver = new Map<string, Stint[]>();

			for (const stint of snapshot.stints) {
				byDriver.set(stint.driverNumber, [...(byDriver.get(stint.driverNumber) ?? []), stint]);
			}

			const proof = `/strategy?session=${info.key}`;
			const order = inOrder(snapshot).filter((driver) => byDriver.has(driver.number));

			if (order.length === 0) {
				return { kind: 'missing', message: `The ${label} has no tyre data.` };
			}

			const rows: TableRow[] = order
				.filter((driver) => isMine(subject, driver))
				.slice(0, 10)
				.map((driver) => ({
					cells: [driver.lastName, stintText(byDriver.get(driver.number) ?? [])],
					href: sessionHref(info.key, driver.number),
					colour: driver.teamColour,
					mark: subject !== null
				}));

			const visual = { kind: 'table' as const, columns: ['Driver', 'Stints'], rows };
			const source = `${label}, ${plural(snapshot.stints.length, 'stint')}`;

			if (subject) {
				return {
					...base,
					headline: mine.flatMap((driver, index) => [
						...(index > 0 ? ['; '] : []),
						car(driver),
						`: ${stintText(byDriver.get(driver.number) ?? []) || 'no stints'}`
					]),
					detail: [`Laps of each set in the ${label}.`],
					visual,
					source,
					proof: { label: 'Open the strategy', href: proof }
				};
			}

			const stops = new Map<number, number>();

			for (const driver of order) {
				const count = Math.max(0, (byDriver.get(driver.number)?.length ?? 1) - 1);

				stops.set(count, (stops.get(count) ?? 0) + 1);
			}

			const common = [...stops.entries()].toSorted((a, b) => b[1] - a[1]);
			const [most] = common[0] ?? [0, 0];
			const leader = order[0];

			return {
				...base,
				headline: [
					`Most drivers ran a `,
					{ text: (STOPS_NAME[most] ?? `${most}-stop`).toLowerCase(), href: proof },
					` at the ${label}`
				],
				detail: [
					common
						.map(
							([count, runners]) =>
								`${plural(runners, 'driver')} ${(STOPS_NAME[count] ?? `${count}-stop`).toLowerCase()}`
						)
						.join(', '),
					'. ',
					...(leader ? [car(leader), `: ${stintText(byDriver.get(leader.number) ?? [])}.`] : [])
				],
				visual,
				source,
				proof: { label: 'Open the strategy', href: proof }
			};
		}

		case 'pit_stops': {
			const proof = `/strategy?session=${info.key}`;
			const crews = crewLeague(snapshot);

			const own = snapshot.pitStops.filter((stop) => {
				const driver = drivers.get(stop.driverNumber);

				return driver !== undefined && isMine(subject, driver);
			});

			if (snapshot.pitStops.length === 0) {
				return { kind: 'missing', message: `Nobody stopped in the ${label}.` };
			}

			if (subject) {
				return {
					...base,
					headline: [
						`${subjectName} made `,
						{ text: plural(own.length, 'stop'), href: proof },
						` in the ${label}`
					],
					detail: own.flatMap((stop, index) => {
						const driver = drivers.get(stop.driverNumber);

						return [
							...(index > 0 ? [', '] : []),
							{
								text: `${subject.kind === 'team' && driver ? `${driver.lastName} ` : ''}lap ${stop.lap}${stop.stationaryMs ? ` (${(stop.stationaryMs / 1000).toFixed(1)} s)` : ''}`,
								href: sessionHref(info.key, stop.driverNumber, stop.lap)
							}
						];
					}),
					visual: null,
					source: `${label}, ${plural(snapshot.pitStops.length, 'stop')}`,
					proof: { label: 'Open the strategy', href: proof }
				};
			}

			const quickest = crews[0];
			const stop = quickest?.stops.find((entry) => entry.stationaryMs === quickest.bestMs);

			if (!quickest || !stop) {
				return { kind: 'missing', message: `The ${label} has no stationary times.` };
			}

			const driver = drivers.get(stop.driverNumber) ?? quickest.driver;

			return {
				...base,
				headline: [
					`${quickest.team} had the quickest stop at the ${label}: `,
					{
						text: `${(stop.stationaryMs / 1000).toFixed(1)} s`,
						href: sessionHref(info.key, stop.driverNumber, stop.lap)
					}
				],
				detail: [
					car(driver, stop.lap),
					` on lap ${stop.lap}. ${plural(snapshot.pitStops.length, 'stop')} in all.`
				],
				visual: {
					kind: 'bars',
					bars: crews.slice(0, 8).map((crew) => ({
						label: crew.team,
						value: crew.bestMs / 1000,
						display: `${(crew.bestMs / 1000).toFixed(1)} s`,
						href: proof,
						colour: crew.driver.teamColour
					}))
				},
				source: `${label}, ${plural(snapshot.pitStops.length, 'stop')}, time stationary`,
				proof: { label: 'Open the strategy', href: proof }
			};
		}

		case 'sectors': {
			const proof = `/analysis?session=${info.key}`;
			const sectors = bestSectors(snapshot);
			const ideal = sectors.ideal.find((entry) => isMine(subject, entry.driver));

			if (sectors.fastest.every((holder) => holder === null)) {
				return { kind: 'missing', message: `The ${label} has no sector times.` };
			}

			const rows: TableRow[] = sectors.fastest.flatMap((holder, index) =>
				holder
					? [
							{
								cells: [`S${index + 1}`, holder.driver.lastName, formatSectorTime(holder.timeMs)],
								href: sessionHref(info.key, holder.driver.number),
								colour: holder.driver.teamColour,
								mark: subject !== null && isMine(subject, holder.driver)
							}
						]
					: []
			);

			return {
				...base,
				headline: ideal
					? [
							car(ideal.driver),
							`'s ideal lap at the ${label}: `,
							{ text: formatLapTime(ideal.idealMs), href: proof },
							ideal.bestMs === null
								? ''
								: ideal.bestMs > ideal.idealMs
									? `, ${((ideal.bestMs - ideal.idealMs) / 1000).toFixed(3)} s quicker than their best lap`
									: ', and their best lap had all three'
						]
					: [`No driver set all three sectors in the ${label}`],
				detail: [
					'Fastest sectors: ',
					...sectors.fastest.flatMap((holder, index) =>
						holder
							? [
									...(index > 0 ? [', '] : []),
									car(holder.driver),
									` ${formatSectorTime(holder.timeMs)}`
								]
							: []
					),
					'.'
				],
				visual: { kind: 'table', columns: ['Sector', 'Driver', 'Time'], rows },
				source: `${label}, ${plural(snapshot.laps.length, 'lap')}`,
				proof: { label: 'Open the analysis', href: proof }
			};
		}
	}
}
