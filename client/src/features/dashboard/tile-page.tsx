import { useParams } from 'react-router';

import { useDashboards } from './dashboard-store';
import { TileFillContext } from './tile-fill';
import { TileContent } from './tiles';

/**
 * One tile on its own, filling the window: for a second monitor, a side screen or a TV. Race
 * state follows the window it was opened from.
 */
export function TilePage() {
	const { dashboardId, tileId } = useParams();
	const { dashboards } = useDashboards();

	const tile = dashboards
		.find((dashboard) => dashboard.id === dashboardId)
		?.tiles.find((entry) => entry.id === tileId);

	if (!tile) {
		return (
			<p className="text-muted-foreground p-6 text-sm" role="alert">
				This tile is no longer on its dashboard.
			</p>
		);
	}

	return (
		<div
			className="min-h-0 flex-1 overflow-auto [&_[data-slot=panel-header]]:sticky [&_[data-slot=panel-header]]:top-0 [&_[data-slot=panel-header]]:z-10"
			data-testid={`tile-${tile.kind}`}
		>
			<TileFillContext value>
				<TileContent tile={tile} />
			</TileFillContext>
		</div>
	);
}
