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
	const rows = standingsAt(snapshot);
	const running = rows.filter((row) => row.state !== 'out');
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
		<div className="bg-border grid gap-px overflow-hidden rounded-lg border lg:grid-cols-[15rem_minmax(0,1fr)]">
			<DriverList
				rows={running}
				selected={selected}
				onToggle={toggle}
				onHighlight={setHighlighted}
			/>
			<ChartWorkspace drivers={compared} highlighted={highlighted} />
			<div className="bg-border grid gap-px lg:col-span-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<PaceRanking />
				<FastestLaps />
			</div>
		</div>
	);
}
