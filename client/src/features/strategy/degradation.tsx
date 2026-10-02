import { Digits } from '@/components/console/digits';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { stintPaces } from '@/insights/tyre-pace';
import { formatDeltaSeconds, formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const SHOWN_STINTS = 10;

/** Wear bars are full at this loss per lap. */
const WEAR_SCALE_SECONDS = 0.08;

/** Above this, a stint is wearing fast enough to force an earlier stop. */
const HIGH_WEAR_SECONDS = 0.04;

export function Degradation() {
	const { snapshot } = useRace();
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));

	const stints = stintPaces(snapshot)
		.toSorted((a, b) => b.degradationSecondsPerLap - a.degradationSecondsPerLap)
		.slice(0, SHOWN_STINTS);

	return (
		<Panel aria-label="Tyre wear" data-testid="degradation">
			<PanelHeader title="Tyre wear" meta="highest first" />
			<div className="flex flex-col gap-3 p-4">
				<ProGate
					feature="Degradation by stint"
					teaser="Which cars are losing the most time per lap to their tyres, and so must stop first."
				>
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b">
								<th scope="col" className="type-label pb-1.5 text-left font-normal">
									Driver
								</th>
								<th scope="col" className="type-label pb-1.5 text-left font-normal">
									Stint
								</th>
								<th scope="col" className="type-label hidden pb-1.5 font-normal sm:table-cell">
									<span className="sr-only">Wear bar</span>
								</th>
								<th scope="col" className="type-label pb-1.5 text-right font-normal">
									Per lap
								</th>
								<th scope="col" className="type-label pb-1.5 text-right font-normal">
									New-tyre pace
								</th>
							</tr>
						</thead>
						<tbody>
							{stints.map((stint) => {
								const driver = drivers.get(stint.driverNumber);
								const wear = Math.max(stint.degradationSecondsPerLap, 0);

								return (
									<tr
										key={`${stint.driverNumber}-${stint.stint}`}
										className="h-9 border-b last:border-b-0"
									>
										<td>{driver ? <DriverTag driver={driver} /> : stint.driverNumber}</td>
										<td>
											<span className="flex items-center gap-2">
												<TyreBadge compound={stint.compound} />
												<span className="type-label">
													S{stint.stint} {stint.cleanLaps}L
												</span>
											</span>
										</td>
										<td className="hidden w-1/3 px-3 sm:table-cell" aria-hidden>
											<span aria-hidden className="border-rule-strong relative block h-2 border-l">
												<span
													className={cn(
														'absolute inset-y-0 left-0 w-(--size)',
														wear > HIGH_WEAR_SECONDS ? 'bg-danger' : 'bg-foreground/50'
													)}
													style={{ '--size': `${Math.min(wear / WEAR_SCALE_SECONDS, 1) * 100}%` }}
												/>
											</span>
										</td>
										<td className="text-right">
											<Digits value={formatDeltaSeconds(stint.degradationSecondsPerLap, 3)} />
										</td>
										<td className="text-right">
											<Digits
												className="text-muted-foreground"
												value={formatLapTime(Math.round(stint.newTyrePaceSeconds * 1000))}
											/>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</ProGate>
				<p className="text-muted-foreground text-xs">
					Fitted from clean laps in each stint, fuel-corrected. Values near zero or below it mean
					the tyre is not yet the limiting factor; short stints are noisy.
				</p>
			</div>
		</Panel>
	);
}
