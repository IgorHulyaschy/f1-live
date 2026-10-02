import * as React from 'react';

import { useRace } from '@/data/race-context';
import { ChartWorkspace } from '@/features/analysis/chart-workspace';
import { DriverList } from '@/features/analysis/driver-list';
import { FastestLaps } from '@/features/analysis/fastest-laps';
import { PaceRanking } from '@/features/analysis/pace-ranking';
import { standingsAt } from '@/insights/standings';

const DEFAULT_COMPARED = 3;

export function AnalysisPage() {
	const { snapshot, followedDriver } = useRace();
	const running = standingsAt(snapshot).filter((row) => row.state !== 'out');
	const [highlighted, setHighlighted] = React.useState<string | null>(null);

	const [selected, setSelected] = React.useState<string[]>(() => {
		const codes = running.slice(0, DEFAULT_COMPARED).map((row) => row.driver.code);
		const followed = running.find((row) => row.driver.number === followedDriver)?.driver.code;

		return followed && !codes.includes(followed) ? [...codes, followed] : codes;
	});

	const toggle = (code: string) =>
		setSelected((current) =>
			current.includes(code)
				? current.length > 1
					? current.filter((entry) => entry !== code)
					: current
				: [...current, code]
		);

	const compared = running
		.map((row) => row.driver)
		.filter((driver) => selected.includes(driver.code));

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-y-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-y-0">
				<div className="lg:border-r">
					<DriverList
						rows={running}
						selected={selected}
						onToggle={toggle}
						onHighlight={setHighlighted}
					/>
				</div>
				<ChartWorkspace drivers={compared} highlighted={highlighted} />
			</div>
			<div className="grid gap-y-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-y-0">
				<div className="lg:border-r">
					<PaceRanking />
				</div>
				<FastestLaps />
			</div>
		</div>
	);
}
