import { DriverTag } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { TyreBadge } from '@/components/tyre-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table';
import { useRace } from '@/data/race-context';
import { stintPaces } from '@/insights/tyre-pace';
import { formatLapTime } from '@/lib/format';

const SHOWN_STINTS = 12;

export function DegradationCard() {
	const { snapshot } = useRace();
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));

	const stints = stintPaces(snapshot)
		.toSorted((a, b) => a.degradationSecondsPerLap - b.degradationSecondsPerLap)
		.slice(0, SHOWN_STINTS);

	return (
		<Card size="sm" data-testid="degradation">
			<CardHeader>
				<CardTitle>Tyre degradation</CardTitle>
				<CardDescription>
					Fitted lap-time loss per lap of tyre age, fuel-corrected. Lowest wear first.
				</CardDescription>
			</CardHeader>
			<CardContent bleed>
				<ProGate feature="Degradation by stint">
					<Table inset>
						<TableHeader>
							<TableRow>
								<TableHead>Driver</TableHead>
								<TableHead>Stint</TableHead>
								<TableHead numeric>Wear / lap</TableHead>
								<TableHead numeric>New-tyre pace</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{stints.map((stint) => {
								const driver = drivers.get(stint.driverNumber);

								return (
									<TableRow key={`${stint.driverNumber}-${stint.stint}`}>
										<TableCell>
											{driver ? <DriverTag driver={driver} /> : stint.driverNumber}
										</TableCell>
										<TableCell>
											<span className="flex items-center gap-2">
												<TyreBadge compound={stint.compound} />
												<span className="text-muted-foreground text-xs">
													{stint.cleanLaps} laps
												</span>
											</span>
										</TableCell>
										<TableCell numeric>+{stint.degradationSecondsPerLap.toFixed(3)}s</TableCell>
										<TableCell numeric>
											{formatLapTime(Math.round(stint.newTyrePaceSeconds * 1000))}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</ProGate>
			</CardContent>
		</Card>
	);
}
