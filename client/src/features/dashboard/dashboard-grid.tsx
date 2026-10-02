import {
	ArrowDownIcon,
	ArrowUpIcon,
	ExternalLinkIcon,
	GripVerticalIcon,
	XIcon
} from 'lucide-react';
import * as React from 'react';
import { type Layout, ReactGridLayout, useContainerWidth } from 'react-grid-layout';
import { useSearchParams } from 'react-router';

import { Key } from '@/components/console/keys';
import { useRemPixels } from '@/hooks/use-scale';
import { cn } from '@/lib/utils';

import {
	type Dashboard,
	GRID_COLUMNS,
	readingOrder,
	removeTile,
	swapTiles,
	type Tile,
	TILE_INFO,
	tileTitle
} from './dashboards';
import { tilePath } from './paths';
import { TileFillContext } from './tile-fill';
import { TileContent } from './tiles';

/** Narrower than this (in rem) a dashboard stacks its tiles in reading order, at natural height. */
const STACK_BELOW_REM = 64;

/** One grid row in rem. */
const ROW_REM = 1.25;

/** The gap between tiles in rem. */
const GAP_REM = 1.25;

function sameLayout(dashboard: Dashboard, layout: Layout): boolean {
	const places = new Map(dashboard.layout.map((place) => [place.i, place]));

	return layout.every((item) => {
		const place = places.get(item.i);

		return (
			place && place.x === item.x && place.y === item.y && place.w === item.w && place.h === item.h
		);
	});
}

function TileBar({
	dashboard,
	tile,
	editing,
	neighbours,
	onChange
}: {
	dashboard: Dashboard;
	tile: Tile;
	editing: boolean;
	neighbours?: { up?: string; down?: string };
	onChange: (dashboard: Dashboard) => void;
}) {
	const [searchParams] = useSearchParams();
	const title = tileTitle(tile);

	if (!editing) {
		return null;
	}

	const popOut = () =>
		window.open(
			`${tilePath(dashboard.id, tile.id)}?${searchParams.toString()}`,
			'_blank',
			'noopener'
		);

	return (
		<div
			data-tile-handle
			className="bg-panel-raised flex h-8 shrink-0 cursor-move items-center gap-1.5 border border-b-0 border-dashed pr-1 pl-1.5"
			data-testid="tile-bar"
		>
			<GripVerticalIcon aria-hidden className="text-muted-foreground size-3.5" />
			<span className="type-label text-foreground truncate">{title}</span>
			<span className="ml-auto flex">
				{neighbours?.up ? (
					<Key
						aria-label={`Move ${title} up`}
						className="h-6 sm:h-6"
						onClick={() => onChange(swapTiles(dashboard, tile.id, neighbours.up ?? ''))}
					>
						<ArrowUpIcon />
					</Key>
				) : null}
				{neighbours?.down ? (
					<Key
						aria-label={`Move ${title} down`}
						className="-ml-px h-6 sm:h-6"
						onClick={() => onChange(swapTiles(dashboard, tile.id, neighbours.down ?? ''))}
					>
						<ArrowDownIcon />
					</Key>
				) : null}
				<Key
					aria-label={`Open ${title} in a new window`}
					className="-ml-px h-6 sm:h-6"
					onClick={popOut}
				>
					<ExternalLinkIcon />
				</Key>
				<Key
					aria-label={`Remove ${title}`}
					className="-ml-px h-6 sm:h-6"
					onClick={() => onChange(removeTile(dashboard, tile.id))}
				>
					<XIcon />
				</Key>
			</span>
		</div>
	);
}

function TileBody({
	dashboard,
	tile,
	fill,
	onChange
}: {
	dashboard: Dashboard;
	tile: Tile;
	fill: boolean;
	onChange: (dashboard: Dashboard) => void;
}) {
	return (
		<div
			className={cn(
				fill &&
					'min-h-0 flex-1 overflow-auto overscroll-contain [&_[data-slot=panel-header]]:sticky [&_[data-slot=panel-header]]:top-0 [&_[data-slot=panel-header]]:z-10'
			)}
		>
			<TileFillContext value={fill}>
				<TileContent
					tile={tile}
					onSettingsChange={(settings) =>
						onChange({
							...dashboard,
							tiles: dashboard.tiles.map((entry) =>
								entry.id === tile.id ? { ...entry, settings } : entry
							)
						})
					}
				/>
			</TileFillContext>
		</div>
	);
}

/**
 * A dashboard's tiles. Wide screens get a 24-column grid where tiles can be dragged and resized
 * in edit mode; narrow screens stack the same tiles in reading order.
 */
export function DashboardGrid({
	dashboard,
	editing,
	onChange
}: {
	dashboard: Dashboard;
	editing: boolean;
	onChange: (dashboard: Dashboard) => void;
}) {
	const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
	const rem = useRemPixels();
	const stacked = width < STACK_BELOW_REM * 16;
	const tiles = new Map(dashboard.tiles.map((tile) => [tile.id, tile]));

	// Minimum sizes come from the tile kind, so the grid enforces them while resizing.
	const layout = React.useMemo<Layout>(() => {
		const kinds = new Map(dashboard.tiles.map((tile) => [tile.id, tile.kind]));

		return dashboard.layout.flatMap((place) => {
			const kind = kinds.get(place.i);

			return kind ? [{ ...place, minW: TILE_INFO[kind].min.w, minH: TILE_INFO[kind].min.h }] : [];
		});
	}, [dashboard]);

	const onLayoutChange = (next: Layout) => {
		if (!editing || sameLayout(dashboard, next)) {
			return;
		}

		onChange({
			...dashboard,
			layout: next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
		});
	};

	if (dashboard.tiles.length === 0) {
		return (
			<div ref={containerRef} className="text-muted-foreground border border-dashed p-8 text-sm">
				{editing
					? 'This dashboard is empty. Add a tile to start.'
					: 'This dashboard is empty. Press Edit, then Add tile.'}
			</div>
		);
	}

	// Wait for the width so tiles mount once, in the right mode, and nothing replays.
	if (!mounted) {
		return <div ref={containerRef} className="min-h-svh" />;
	}

	if (stacked) {
		const ordered = readingOrder(dashboard);

		return (
			<div ref={containerRef} className="flex flex-col gap-6" data-testid="dashboard-stack">
				{ordered.map((tile, index) => (
					<div key={tile.id} className="flex min-w-0 flex-col" data-testid={`tile-${tile.kind}`}>
						<TileBar
							dashboard={dashboard}
							tile={tile}
							editing={editing}
							neighbours={{ up: ordered[index - 1]?.id, down: ordered[index + 1]?.id }}
							onChange={onChange}
						/>
						<TileBody dashboard={dashboard} tile={tile} fill={false} onChange={onChange} />
					</div>
				))}
			</div>
		);
	}

	return (
		<div ref={containerRef} data-testid="dashboard-grid" data-editing={editing || undefined}>
			<ReactGridLayout
				width={width}
				layout={layout}
				gridConfig={{
					cols: GRID_COLUMNS,
					rowHeight: ROW_REM * rem,
					margin: [GAP_REM * rem, GAP_REM * rem],
					containerPadding: [0, 0]
				}}
				dragConfig={{ enabled: editing, handle: '[data-tile-handle]', cancel: 'button' }}
				resizeConfig={{ enabled: editing, handles: ['se', 'e', 's'] }}
				onLayoutChange={onLayoutChange}
			>
				{dashboard.layout.flatMap((place) => {
					const tile = tiles.get(place.i);

					return tile
						? [
								<div
									key={tile.id}
									className="flex min-w-0 flex-col"
									data-testid={`tile-${tile.kind}`}
								>
									<TileBar
										dashboard={dashboard}
										tile={tile}
										editing={editing}
										onChange={onChange}
									/>
									<TileBody dashboard={dashboard} tile={tile} fill onChange={onChange} />
								</div>
							]
						: [];
				})}
			</ReactGridLayout>
		</div>
	);
}
