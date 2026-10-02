import { ChartWorkspace } from '@/features/analysis/chart-workspace';
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

import type { Tile, TileSettings } from './dashboards';

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
				<ChartWorkspace
					metric={tile.settings?.metric}
					onMetricChange={(metric: Metric) => onSettingsChange?.({ ...tile.settings, metric })}
				/>
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
	}
}
