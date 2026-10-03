import * as React from 'react';

import { Panel, PanelHeader } from '@/components/console/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { DriverList } from '@/features/analysis/driver-list';
import { FastestLaps } from '@/features/analysis/fastest-laps';
import type { Metric } from '@/features/analysis/lap-series';
import { PaceRanking } from '@/features/analysis/pace-ranking';
import { DriverCard, GridWall } from '@/features/drivers/driver-tiles';
import { FocusPanel } from '@/features/live/focus-panel';
import { BoxNowPanel, GapsPanel } from '@/features/live/focus-tiles';
import { RaceControlFeed } from '@/features/live/race-control-feed';
import { TimingTower } from '@/features/live/timing-tower';
import {
	LapStripTile,
	ReplayTile,
	SessionTile,
	WeatherTile
} from '@/features/session/session-tiles';
import { Degradation } from '@/features/strategy/degradation';
import { PitStops } from '@/features/strategy/pit-stops';
import { StintChart } from '@/features/strategy/stint-chart';
import { TrackMapTile } from '@/features/track/track-map-tile';

import type { Tile, TileSettings } from './dashboards';

// The chart library is the heaviest part of the app; it loads only with a chart tile.
const ChartWorkspace = React.lazy(async () => ({
	default: (await import('@/features/analysis/chart-workspace')).ChartWorkspace
}));

/** A tile whose code is still loading: its ruled header and a quiet placeholder. */
function LoadingTile({ title }: { title: string }) {
	return (
		<Panel aria-label={title} aria-busy>
			<PanelHeader title={title} />
			<div className="flex flex-col gap-3 p-4">
				<Skeleton className="h-3 w-2/3" />
				<Skeleton className="h-40 w-full" />
			</div>
		</Panel>
	);
}

/** The panel a tile shows. Panels read race state themselves; tiles only add their settings. */
export function TileContent({
	tile,
	onSettingsChange
}: {
	tile: Tile;
	onSettingsChange?: (settings: TileSettings) => void;
}) {
	switch (tile.kind) {
		case 'session': {
			return <SessionTile />;
		}

		case 'replay': {
			return <ReplayTile />;
		}

		case 'lap-strip': {
			return <LapStripTile />;
		}

		case 'weather': {
			return <WeatherTile />;
		}

		case 'driver': {
			return <DriverCard />;
		}

		case 'grid': {
			return <GridWall />;
		}

		case 'timing': {
			return <TimingTower />;
		}

		case 'focus': {
			return <FocusPanel />;
		}

		case 'gaps': {
			return <GapsPanel />;
		}

		case 'box-now': {
			return <BoxNowPanel />;
		}

		case 'race-control': {
			return <RaceControlFeed />;
		}

		case 'chart': {
			return (
				<React.Suspense fallback={<LoadingTile title="Trace" />}>
					<ChartWorkspace
						metric={tile.settings?.metric}
						onMetricChange={(metric: Metric) => onSettingsChange?.({ ...tile.settings, metric })}
					/>
				</React.Suspense>
			);
		}

		case 'compare': {
			return <DriverList />;
		}

		case 'pace': {
			return <PaceRanking />;
		}

		case 'fastest-laps': {
			return <FastestLaps />;
		}

		case 'stints': {
			return <StintChart />;
		}

		case 'degradation': {
			return <Degradation />;
		}

		case 'pit-stops': {
			return <PitStops />;
		}

		case 'track-map': {
			return (
				<TrackMapTile
					settings={tile.settings}
					onSettingsChange={(settings) => onSettingsChange?.({ ...tile.settings, ...settings })}
				/>
			);
		}
	}
}
