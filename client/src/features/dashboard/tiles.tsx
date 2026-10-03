import * as React from 'react';

import { Panel, PanelHeader } from '@/components/console/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { DriverList } from '@/features/analysis/driver-list';
import { FastestLaps } from '@/features/analysis/fastest-laps';
import type { Metric } from '@/features/analysis/lap-series';
import { PaceRanking } from '@/features/analysis/pace-ranking';
import { BestSectors } from '@/features/live/best-sectors';
import { FocusPanel } from '@/features/live/focus-panel';
import { KnockoutPanel } from '@/features/live/knockout-panel';
import { RaceControlFeed } from '@/features/live/race-control-feed';
import { TimingTower } from '@/features/live/timing-tower';
import { LapStripTile, SessionTile, WeatherTile } from '@/features/session/session-tiles';
import { Timeline } from '@/features/session/timeline';
import { LongRuns } from '@/features/strategy/long-runs';
import { StintChart } from '@/features/strategy/stint-chart';

import { type Tile, type TileSettings, tileTitle } from './dashboards';

// The chart library is the heaviest part of the app; it loads only with a chart tile.
const ChartWorkspace = React.lazy(async () => ({
	default: (await import('@/features/analysis/chart-workspace')).ChartWorkspace
}));

const TelemetryPanel = React.lazy(async () => ({
	default: (await import('@/features/analysis/telemetry-panel')).TelemetryPanel
}));

const ChampionshipSwing = React.lazy(async () => ({
	default: (await import('@/features/analysis/championship-swing')).ChampionshipSwing
}));

const ConditionsPanel = React.lazy(async () => ({
	default: (await import('@/features/analysis/conditions-panel')).ConditionsPanel
}));

// Tiles that no session layout opens with load on first use, keeping the first download small.
const DriverCard = React.lazy(async () => ({
	default: (await import('@/features/drivers/driver-tiles')).DriverCard
}));

const GridWall = React.lazy(async () => ({
	default: (await import('@/features/drivers/driver-tiles')).GridWall
}));

const BoxNowPanel = React.lazy(async () => ({
	default: (await import('@/features/live/focus-tiles')).BoxNowPanel
}));

const GapsPanel = React.lazy(async () => ({
	default: (await import('@/features/live/focus-tiles')).GapsPanel
}));

const Degradation = React.lazy(async () => ({
	default: (await import('@/features/strategy/degradation')).Degradation
}));

const PitCost = React.lazy(async () => ({
	default: (await import('@/features/strategy/pit-cost')).PitCost
}));

const PitCrews = React.lazy(async () => ({
	default: (await import('@/features/strategy/pit-crews')).PitCrews
}));

const PitStops = React.lazy(async () => ({
	default: (await import('@/features/strategy/pit-stops')).PitStops
}));

const UndercutLedger = React.lazy(async () => ({
	default: (await import('@/features/strategy/undercut-ledger')).UndercutLedger
}));

const StoryRibbon = React.lazy(async () => ({
	default: (await import('@/features/story/story-ribbon')).StoryRibbon
}));

// The maps share a drawing engine most dashboards never use; it loads with the first map tile.
const BattleMapTile = React.lazy(async () => ({
	default: (await import('@/features/track/battle-map-tile')).BattleMapTile
}));

const DominanceTile = React.lazy(async () => ({
	default: (await import('@/features/track/dominance-tile')).DominanceTile
}));

const FlagMapTile = React.lazy(async () => ({
	default: (await import('@/features/track/flag-map-tile')).FlagMapTile
}));

const PitRejoinTile = React.lazy(async () => ({
	default: (await import('@/features/track/pit-rejoin-tile')).PitRejoinTile
}));

const SpeedMapTile = React.lazy(async () => ({
	default: (await import('@/features/track/speed-map-tile')).SpeedMapTile
}));

const SeasonStandingsTile = React.lazy(async () => ({
	default: (await import('@/features/history/standings-tile')).SeasonStandingsTile
}));

const GapsTile = React.lazy(async () => ({
	default: (await import('@/features/gaps/gaps-tile')).GapsTile
}));

const GhostLapTile = React.lazy(async () => ({
	default: (await import('@/features/gaps/ghost-lap-tile')).GhostLapTile
}));

const TrackMapTile = React.lazy(async () => ({
	default: (await import('@/features/track/track-map-tile')).TrackMapTile
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

/** A tile whose code loads on first use, with its loading state in the meantime. */
function LazyTile({ tile, children }: { tile: Tile; children: React.ReactNode }) {
	return (
		<React.Suspense fallback={<LoadingTile title={tileTitle(tile)} />}>{children}</React.Suspense>
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
			return <Timeline />;
		}

		case 'lap-strip': {
			return <LapStripTile />;
		}

		case 'weather': {
			return <WeatherTile />;
		}

		case 'driver': {
			return (
				<LazyTile tile={tile}>
					<DriverCard />
				</LazyTile>
			);
		}

		case 'grid': {
			return (
				<LazyTile tile={tile}>
					<GridWall />
				</LazyTile>
			);
		}

		case 'timing': {
			return <TimingTower />;
		}

		case 'focus': {
			return <FocusPanel />;
		}

		case 'gaps': {
			return (
				<LazyTile tile={tile}>
					<GapsPanel />
				</LazyTile>
			);
		}

		case 'box-now': {
			return (
				<LazyTile tile={tile}>
					<BoxNowPanel />
				</LazyTile>
			);
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
			return (
				<LazyTile tile={tile}>
					<Degradation />
				</LazyTile>
			);
		}

		case 'pit-stops': {
			return (
				<LazyTile tile={tile}>
					<PitStops />
				</LazyTile>
			);
		}

		case 'story': {
			return (
				<LazyTile tile={tile}>
					<StoryRibbon />
				</LazyTile>
			);
		}

		case 'telemetry': {
			return (
				<React.Suspense fallback={<LoadingTile title="Telemetry" />}>
					<TelemetryPanel />
				</React.Suspense>
			);
		}

		case 'undercut': {
			return (
				<LazyTile tile={tile}>
					<UndercutLedger />
				</LazyTile>
			);
		}

		case 'pit-cost': {
			return (
				<LazyTile tile={tile}>
					<PitCost />
				</LazyTile>
			);
		}

		case 'pit-crews': {
			return (
				<LazyTile tile={tile}>
					<PitCrews />
				</LazyTile>
			);
		}

		case 'championship': {
			return (
				<React.Suspense fallback={<LoadingTile title="Championship" />}>
					<ChampionshipSwing />
				</React.Suspense>
			);
		}

		case 'knockout': {
			return <KnockoutPanel />;
		}

		case 'sectors': {
			return <BestSectors />;
		}

		case 'long-runs': {
			return <LongRuns />;
		}

		case 'conditions': {
			return (
				<React.Suspense fallback={<LoadingTile title="Conditions" />}>
					<ConditionsPanel />
				</React.Suspense>
			);
		}

		case 'track-map': {
			return (
				<LazyTile tile={tile}>
					<TrackMapTile
						settings={tile.settings}
						onSettingsChange={(settings) => onSettingsChange?.({ ...tile.settings, ...settings })}
					/>
				</LazyTile>
			);
		}

		case 'battle-map': {
			return (
				<LazyTile tile={tile}>
					<BattleMapTile />
				</LazyTile>
			);
		}

		case 'pit-rejoin': {
			return (
				<LazyTile tile={tile}>
					<PitRejoinTile />
				</LazyTile>
			);
		}

		case 'dominance': {
			return (
				<LazyTile tile={tile}>
					<DominanceTile
						span={tile.settings?.span}
						onSpanChange={(span) => onSettingsChange?.({ ...tile.settings, span })}
					/>
				</LazyTile>
			);
		}

		case 'flag-map': {
			return (
				<LazyTile tile={tile}>
					<FlagMapTile />
				</LazyTile>
			);
		}

		case 'speed-map': {
			return (
				<LazyTile tile={tile}>
					<SpeedMapTile
						channel={tile.settings?.channel}
						onChannelChange={(channel) => onSettingsChange?.({ ...tile.settings, channel })}
					/>
				</LazyTile>
			);
		}

		case 'gap-distance': {
			return (
				<LazyTile tile={tile}>
					<GapsTile
						settings={tile.settings}
						onSettingsChange={(settings) => onSettingsChange?.({ ...tile.settings, ...settings })}
					/>
				</LazyTile>
			);
		}

		case 'season-standings': {
			return (
				<LazyTile tile={tile}>
					<SeasonStandingsTile />
				</LazyTile>
			);
		}

		case 'ghost-lap': {
			return (
				<LazyTile tile={tile}>
					<GhostLapTile />
				</LazyTile>
			);
		}
	}
}
