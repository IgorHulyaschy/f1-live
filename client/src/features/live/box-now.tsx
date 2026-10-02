import { Digits } from '@/components/console/digits';
import { useRace } from '@/data/race-context';
import { predictRejoin } from '@/insights/pit-window';

/** A car within this much at the rejoin point means coming out in traffic. */
const TRAFFIC_MS = 1500;

/** What happens if the followed driver pits at the end of this lap, in pit-wall words. */
export function BoxNow({ driverNumber }: { driverNumber: string }) {
	const { snapshot } = useRace();
	const prediction = predictRejoin(snapshot, driverNumber);

	if (!prediction) {
		return <p className="text-muted-foreground text-sm">No prediction while the car is out.</p>;
	}

	const traffic =
		(prediction.carAhead && prediction.carAhead.gapMs < TRAFFIC_MS) ||
		(prediction.carBehind && prediction.carBehind.gapMs < TRAFFIC_MS);

	return (
		<div className="flex flex-col gap-3" data-testid="pit-window">
			<div className="flex items-baseline justify-between gap-3">
				<p className="type-wide text-xl leading-none font-black italic">
					Box now, P{prediction.rejoinPosition}
				</p>
				<span className="type-label">from P{prediction.currentPosition}</span>
			</div>
			<dl className="grid grid-cols-3 divide-x border-y">
				<div className="flex flex-col py-2 pr-3">
					<dt className="type-label">Ahead</dt>
					<dd className="text-sm">
						{prediction.carAhead ? (
							<>
								<span className="font-bold">{prediction.carAhead.driver.code}</span>{' '}
								<Digits value={`+${(prediction.carAhead.gapMs / 1000).toFixed(1)}`} />
							</>
						) : (
							'Clear'
						)}
					</dd>
				</div>
				<div className="flex flex-col px-3 py-2">
					<dt className="type-label">Behind</dt>
					<dd className="text-sm">
						{prediction.carBehind ? (
							<>
								<span className="font-bold">{prediction.carBehind.driver.code}</span>{' '}
								<Digits value={`−${(prediction.carBehind.gapMs / 1000).toFixed(1)}`} />
							</>
						) : (
							'Clear'
						)}
					</dd>
				</div>
				<div className="flex flex-col py-2 pl-3">
					<dt className="type-label">Air</dt>
					<dd className={traffic ? 'text-flag text-sm font-bold' : 'text-sm'}>
						{traffic ? 'Traffic' : 'Free'}
					</dd>
				</div>
			</dl>
			<p className="text-muted-foreground text-xs">
				Assumes a {(prediction.pitLossMs / 1000).toFixed(1)}s stop
				{prediction.cheapStop ? ' under the VSC, cheaper than usual' : ' at green-flag pace'}. The
				dashed row in the timing shows where the car would come out.
			</p>
		</div>
	);
}
