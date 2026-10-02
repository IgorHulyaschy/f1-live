import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { Badge } from '@/components/ui/badge';
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

export function PitStopsCard() {
	const { snapshot } = useRace();
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const stops = snapshot.pitStops.toReversed();

	return (
		<Card size="sm" data-testid="pit-stops">
			<CardHeader>
				<CardTitle>Pit stops</CardTitle>
				<CardDescription>Most recent first, with the tyres fitted.</CardDescription>
			</CardHeader>
			<CardContent bleed>
				{stops.length === 0 ? (
					<p className="text-muted-foreground px-4 text-sm">No stops yet.</p>
				) : (
					<Table inset>
						<TableHeader>
							<TableRow>
								<TableHead>Lap</TableHead>
								<TableHead>Driver</TableHead>
								<TableHead>Fitted</TableHead>
								<TableHead numeric>Lane time</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{stops.map((stop) => {
								const driver = drivers.get(stop.driverNumber);

								const nextStint = snapshot.stints.find(
									(stint) =>
										stint.driverNumber === stop.driverNumber && stint.startLap === stop.lap + 1
								);

								const underVsc = snapshot.laps.some(
									(lap) =>
										lap.driverNumber === stop.driverNumber &&
										lap.lap === stop.lap &&
										lap.trackStatus === 'vsc'
								);

								return (
									<TableRow key={`${stop.driverNumber}-${stop.lap}`}>
										<TableCell>{stop.lap}</TableCell>
										<TableCell>
											<span className="flex items-center gap-2">
												{driver ? <DriverTag driver={driver} /> : stop.driverNumber}
												{underVsc ? <Badge variant="warning">VSC</Badge> : null}
											</span>
										</TableCell>
										<TableCell>
											{nextStint ? (
												<TyreBadge compound={nextStint.compound} />
											) : (
												<span className="text-muted-foreground">In the lane</span>
											)}
										</TableCell>
										<TableCell numeric>{(stop.laneTimeMs / 1000).toFixed(1)}s</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
