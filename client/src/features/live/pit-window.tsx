import { Eyebrow } from '@/components/console/panel';
import { useRace } from '@/data/race-context';
import { predictRejoin } from '@/insights/pit-window';
import { standingsAt } from '@/insights/standings';
import { cn } from '@/lib/utils';

/** Seconds shown either side of the rejoin point. */
const WINDOW_MS = 12_000;

/** Where the followed driver would come out if they pitted this lap, against the cars around it. */
export function PitWindow({ driverNumber }: { driverNumber: string }) {
	const { snapshot } = useRace();
	const prediction = predictRejoin(snapshot, driverNumber);

	if (!prediction) {
		return <p className="text-muted-foreground text-sm">No prediction while the car is out.</p>;
	}

	const rows = standingsAt(snapshot).filter((row) => row.state !== 'out' && row.lapsDown === 0);
	const subject = rows.find((row) => row.driver.number === driverNumber);
	const subjectGap = subject?.position === 1 ? 0 : (subject?.gapToLeaderMs ?? 0);
	const rejoinGap = subjectGap + prediction.pitLossMs;

	const offset = (gapMs: number) =>
		`${((gapMs - (rejoinGap - WINDOW_MS)) / (2 * WINDOW_MS)) * 100}%`;

	const neighbours = new Set([
		prediction.carAhead?.driver.number,
		prediction.carBehind?.driver.number
	]);

	const nearby = rows.filter((row) => {
		const gap = row.position === 1 ? 0 : (row.gapToLeaderMs ?? 0);

		return row.driver.number !== driverNumber && Math.abs(gap - rejoinGap) <= WINDOW_MS;
	});

	return (
		<div className="flex flex-col gap-3" data-testid="pit-window">
			<div className="flex items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Eyebrow>If {prediction.driver.code} pits now</Eyebrow>
					<p className="font-display text-2xl leading-none font-bold">
						Rejoins P{prediction.rejoinPosition}
						<span className="text-muted-foreground text-base font-semibold">
							{' '}
							from P{prediction.currentPosition}
						</span>
					</p>
				</div>
				<span
					className={cn(
						'font-display rounded-sm px-1.5 py-0.5 text-xs font-bold tracking-wider uppercase',
						prediction.cheapStop
							? 'bg-safety-car text-background'
							: 'bg-muted text-muted-foreground'
					)}
				>
					{prediction.cheapStop ? 'Cheap stop' : `−${(prediction.pitLossMs / 1000).toFixed(1)}s`}
				</span>
			</div>
			<div aria-hidden className="relative h-16">
				<span className="bg-border absolute inset-x-0 top-7 h-px" />
				{nearby.map((row) => {
					const gap = row.position === 1 ? 0 : (row.gapToLeaderMs ?? 0);
					const named = neighbours.has(row.driver.number);

					return (
						<span
							key={row.driver.number}
							className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1 left-(--offset)"
							style={{ '--offset': offset(gap) }}
						>
							<span className={cn('font-display text-xs font-semibold', !named && 'opacity-0')}>
								{row.driver.code}
							</span>
							<span
								className="bg-team size-2.5 rounded-full"
								style={{ '--team': `#${row.driver.teamColour}` }}
							/>
						</span>
					);
				})}
				<span
					className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1 left-(--offset)"
					style={{ '--offset': offset(rejoinGap) }}
				>
					<span className="h-4" />
					<span className="border-primary bg-panel size-3 rounded-full border-2 border-dashed" />
					<span className="text-primary font-display text-xs font-bold">
						{prediction.driver.code}
					</span>
				</span>
			</div>
			<p className="text-muted-foreground text-xs">
				{prediction.carAhead
					? `${(prediction.carAhead.gapMs / 1000).toFixed(1)}s behind ${prediction.carAhead.driver.code}`
					: 'Clear air ahead'}
				{' · '}
				{prediction.carBehind
					? `${(prediction.carBehind.gapMs / 1000).toFixed(1)}s ahead of ${prediction.carBehind.driver.code}`
					: 'nobody close behind'}
			</p>
		</div>
	);
}
