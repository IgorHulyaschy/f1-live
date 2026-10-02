import * as React from 'react';

import { useRace } from '@/data/race-context';
import { DriverPicker } from '@/features/analysis/driver-picker';
import { LapMetricChart } from '@/features/analysis/lap-charts';
import { PaceRankingCard } from '@/features/analysis/pace-ranking-card';
import { standingsAt } from '@/insights/standings';

const DEFAULT_COMPARED = 3;

export function AnalysisPage() {
	const { snapshot, followedDriver } = useRace();
	const running = standingsAt(snapshot).filter((row) => row.state !== 'out');

	const [selected, setSelected] = React.useState<string[]>(() => {
		const codes = running.slice(0, DEFAULT_COMPARED).map((row) => row.driver.code);
		const followed = running.find((row) => row.driver.number === followedDriver)?.driver.code;

		return followed && !codes.includes(followed) ? [...codes, followed] : codes;
	});

	const drivers = running.map((row) => row.driver);
	const compared = drivers.filter((driver) => selected.includes(driver.code));

	return (
		<div className="flex flex-col gap-4">
			<DriverPicker drivers={drivers} selected={selected} onChange={setSelected} />
			<div className="grid gap-4 xl:grid-cols-2">
				<LapMetricChart snapshot={snapshot} drivers={compared} metric="lapTime" />
				<LapMetricChart snapshot={snapshot} drivers={compared} metric="gap" />
				<LapMetricChart snapshot={snapshot} drivers={compared} metric="position" />
				<PaceRankingCard />
			</div>
		</div>
	);
}
