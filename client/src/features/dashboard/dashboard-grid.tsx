import {
	ArrowDownIcon,
	ArrowUpIcon,
	EllipsisIcon,
	ExternalLinkIcon,
	GripVerticalIcon,
	PencilIcon,
	XIcon
} from 'lucide-react';
import * as React from 'react';
import { type Layout, ReactGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useSearchParams } from 'react-router';

import { Key } from '@/components/console/keys';
import { Transport } from '@/components/race-clock';
import { PanelMenuContext } from '@/components/console/panel';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useRaceView } from '@/data/race-context';
import { useRemPixels } from '@/hooks/use-scale';
import { cn } from '@/lib/utils';

import {
	type Dashboard,
	GRID_COLUMNS,
	moveInStack,
	onScreen,
	removeTile,
	SCREEN_ROWS,
	type ScreenClass,
	sessionKind,
	stackOrder,
	type Tile,
	TILE_INFO,
	type TileKind,
	tileTitle,
	withPlacements
} from './dashboards';
import { tilePath } from './paths';
import { appliesTo, forSession } from './session-layouts';
import { type ArrangeKey, arrangeTile } from './arrange';
import { NearViewport } from './near-viewport';
import { TileFillContext, TileRowsContext } from './tile-fill';
import { TileContent } from './tiles';
import { useCarriedSearch } from './use-carried-search';

const ARRANGE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function arrangeKey(key: string): ArrangeKey {
	return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' ? key : 'ArrowRight';
}

/** Narrower than this (in rem) a dashboard stacks its tiles in reading order, at natural height. */
const STACK_BELOW_REM = 64;

/** The gap between tiles, both ways, in rem. */
const GAP_REM = 1;

/** The gap between rows while editing: room for a tile bar with full-size (24px) keys. */
const EDIT_ROW_GAP_REM = 1.5;

/**
 * One row and the gap under it, in rem, on a window of average height. Rows stretch or shrink so
 * a screen's worth of them fills the window, but stay within half again and three quarters of
 * this: a short window scrolls rather than squeeze tiles, and a dashboard of few rows does not
 * balloon.
 */
const ROW_PITCH_REM = 2.5;

/** Windows at least this many times wider than tall are ultrawide, with four columns of tiles. */
const WIDE_ASPECT = 2.2;

/** A short laptop window is wide by aspect too, but its four columns would be too narrow. */
const WIDE_MIN_WIDTH = 1600;

/** Room left under the grid, in rem, so the last row does not touch the window's edge. */
const BOTTOM_REM = 1;

type WindowFit = { height: number; screen: ScreenClass };

function screenClass(): ScreenClass {
	return window.innerWidth >= WIDE_MIN_WIDTH &&
		window.innerWidth / window.innerHeight >= WIDE_ASPECT
		? 'wide'
		: 'standard';
}

/**
 * The window height left below the grid's top edge, and the screen class, kept up to date as the
 * window resizes and as anything above the grid comes and goes.
 */
function useWindowFit(ref: React.RefObject<HTMLDivElement | null>, rem: number): WindowFit {
	const [fit, setFit] = React.useState<WindowFit>(() => ({
		height: window.innerHeight,
		screen: screenClass()
	}));

	React.useLayoutEffect(() => {
		const measure = () => {
			const top = (ref.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
			const height = Math.round(window.innerHeight - top - BOTTOM_REM * rem);
			const screen = screenClass();

			setFit((current) =>
				current.height === height && current.screen === screen ? current : { height, screen }
			);
		};

		measure();
		window.addEventListener('resize', measure);

		const parent = ref.current?.parentElement;
		const observer = new ResizeObserver(measure);

		if (parent) {
			observer.observe(parent);
		}

		return () => {
			window.removeEventListener('resize', measure);
			observer.disconnect();
		};
	}, [ref, rem]);

	return fit;
}

/** Pixels from one row's top to the next: a screen's worth of rows fills the window height. */
function rowPitch(height: number, rows: number, gap: number, rem: number): number {
	const fill = (height + gap) / Math.min(Math.max(rows, 1), SCREEN_ROWS);

	return Math.min(Math.max(fill, 0.75 * ROW_PITCH_REM * rem), 1.5 * ROW_PITCH_REM * rem);
}

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
	screen,
	tile,
	editing,
	neighbours,
	floating = false,
	onChange
}: {
	/** As saved: every change is made to this, whichever screen it is made on. */
	dashboard: Dashboard;
	/** The screen class whose arrangement the arrow keys change. */
	screen: ScreenClass;
	tile: Tile;
	editing: boolean;
	neighbours?: { up?: string; down?: string };
	/**
	 * On the grid the bar sits in the gap above its tile, like a tab, so editing takes no height
	 * from any tile and the layout looks the same as when it is done.
	 */
	floating?: boolean;
	onChange: (dashboard: Dashboard) => void;
}) {
	const search = useCarriedSearch();
	const title = tileTitle(tile);

	if (!editing) {
		return null;
	}

	const popOut = () =>
		window.open(`${tilePath(dashboard.id, tile.id)}?${search}`, '_blank', 'noopener');

	return (
		<div
			data-tile-handle
			className={cn(
				'bg-panel-raised flex shrink-0 cursor-move items-center gap-1.5 border border-b-0 border-dashed pr-1 pl-1.5',
				floating ? 'absolute inset-x-0 -top-6 z-10 h-6' : 'h-8'
			)}
			data-testid="tile-bar"
		>
			<button
				type="button"
				aria-label={`Arrange ${title}`}
				aria-describedby="tile-arrange-help"
				data-tile-grip
				className={cn(
					'text-muted-foreground hover:text-foreground focus-visible:ring-ring flex shrink-0 cursor-move items-center justify-center focus-visible:ring-2 focus-visible:outline-none',
					'size-6'
				)}
				onKeyDown={(event) => {
					if (ARRANGE_KEYS.has(event.key)) {
						event.preventDefault();
						event.stopPropagation();
						const view = onScreen(dashboard, screen);
						const arranged = arrangeTile(view, tile.id, arrangeKey(event.key), event.shiftKey);

						onChange(withPlacements(dashboard, screen, arranged.layout));
						// The tile re-renders in its new place; keep the keyboard on its grip.
						requestAnimationFrame(() =>
							document
								.querySelector<HTMLButtonElement>(
									`[data-tile-id="${CSS.escape(tile.id)}"] [data-tile-grip]`
								)
								?.focus()
						);
					}
				}}
			>
				<GripVerticalIcon aria-hidden className="size-3.5" />
			</button>
			<span className="type-label text-foreground truncate">{title}</span>
			<span className="ml-auto flex">
				{neighbours?.up ? (
					<Key
						aria-label={`Move ${title} up`}
						className="h-6 sm:h-6"
						onClick={() => onChange(moveInStack(dashboard, tile.id, neighbours.up ?? ''))}
					>
						<ArrowUpIcon />
					</Key>
				) : null}
				{neighbours?.down ? (
					<Key
						aria-label={`Move ${title} down`}
						className="-ml-px h-6 sm:h-6"
						onClick={() => onChange(moveInStack(dashboard, tile.id, neighbours.down ?? ''))}
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
					onClick={() => {
						onChange(removeTile(dashboard, tile.id));
						// The tile and its bar are gone; hand focus to Add tile rather than the page.
						requestAnimationFrame(() =>
							document.querySelector<HTMLButtonElement>('[data-add-tile]')?.focus()
						);
					}}
				>
					<XIcon />
				</Key>
			</span>
		</div>
	);
}

/** The rest of a tile's actions, at the end of its header, when the dashboard is not being edited. */
function TileOptions({ dashboard, tile }: { dashboard: Dashboard; tile: Tile }) {
	const search = useCarriedSearch();
	const [searchParams, setSearchParams] = useSearchParams();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Key
					aria-label={`Options for ${tileTitle(tile)}`}
					className="px-1.5 sm:px-1.5"
					data-testid="tile-options"
				>
					<EllipsisIcon aria-hidden />
				</Key>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuItem
					onSelect={() =>
						window.open(`${tilePath(dashboard.id, tile.id)}?${search}`, '_blank', 'noopener')
					}
				>
					<ExternalLinkIcon aria-hidden />
					Open in a new window
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						const params = new URLSearchParams(searchParams);

						params.set('edit', '1');
						setSearchParams(params);
					}}
				>
					<PencilIcon aria-hidden />
					Edit the dashboard
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A tile that scrolls but holds nothing to press is a tab stop, so the keyboard can scroll it.
 * Tiles with keys or links inside are reached through those, and add no stop of their own.
 */
function useScrollStop(body: React.RefObject<HTMLDivElement | null>, fill: boolean): boolean {
	const [stop, setStop] = React.useState(false);

	React.useEffect(() => {
		const element = body.current;

		if (!fill || !element) {
			return;
		}

		const update = () =>
			setStop(
				element.scrollHeight > element.clientHeight &&
					!element.firstElementChild?.querySelector(FOCUSABLE)
			);

		const observer = new ResizeObserver(update);

		observer.observe(element);

		if (element.firstElementChild) {
			observer.observe(element.firstElementChild);
		}

		return () => observer.disconnect();
	}, [body, fill]);

	return fill && stop;
}

/** Tiles whose first render is heavy (a chart library, long traces): they wait until near. */
const DEFERRED_TILES: ReadonlySet<TileKind> = new Set([
	'chart',
	'telemetry',
	'story',
	'track-map',
	'gap-distance',
	'ghost-lap'
]);

/** A tile for another kind of session, shrunk to the line saying what it is for. */
function AwayTile({ tile }: { tile: Tile }) {
	return (
		<p
			className="flex h-full min-h-9 items-center gap-3 border border-dashed px-4"
			data-testid="tile-away"
		>
			<span aria-hidden className="hatch text-rule-strong h-3 w-4 shrink-0" />
			<span className="type-wide truncate text-xs font-bold">{tileTitle(tile)}</span>
			<span className="type-label shrink-0">{appliesTo(tile)}</span>
		</p>
	);
}

function TileBody({
	dashboard,
	rows,
	tile,
	fill,
	away,
	editing,
	onChange
}: {
	dashboard: Dashboard;
	/** The tile's height in grid rows as shown; null on the phone stack. */
	rows: number | null;
	tile: Tile;
	fill: boolean;
	away: boolean;
	editing: boolean;
	onChange: (dashboard: Dashboard) => void;
}) {
	const body = React.useRef<HTMLDivElement>(null);
	const scrollStop = useScrollStop(body, fill);

	const content = (
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
	);

	if (away) {
		return <AwayTile tile={tile} />;
	}

	return (
		<div
			ref={body}
			role={scrollStop ? 'group' : undefined}
			aria-label={scrollStop ? tileTitle(tile) : undefined}
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
			tabIndex={scrollStop ? 0 : undefined}
			className={cn(
				fill &&
					'min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:outline-none focus-visible:ring-inset [&_[data-slot=panel-header]]:sticky [&_[data-slot=panel-header]]:top-0 [&_[data-slot=panel-header]]:z-10'
			)}
		>
			<TileFillContext value={fill}>
				<TileRowsContext value={rows}>
					<PanelMenuContext
						value={editing ? null : <TileOptions dashboard={dashboard} tile={tile} />}
					>
						{DEFERRED_TILES.has(tile.kind) ? (
							<NearViewport title={tileTitle(tile)} fill={fill}>
								{content}
							</NearViewport>
						) : (
							content
						)}
					</PanelMenuContext>
				</TileRowsContext>
			</TileFillContext>
		</div>
	);
}

/**
 * A dashboard's tiles. Wide screens get a 24-column grid that fills the window, where tiles can be
 * dragged and resized in edit mode; an ultrawide screen shows the dashboard's own arrangement for
 * it when there is one. Narrow screens stack the same tiles.
 */
export function DashboardGrid({
	dashboard: saved,
	editing,
	onChange
}: {
	dashboard: Dashboard;
	editing: boolean;
	onChange: (dashboard: Dashboard) => void;
}) {
	const { race } = useRaceView();
	const shownKind = sessionKind(race.session.type);
	const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
	const rem = useRemPixels();
	const { height, screen } = useWindowFit(containerRef, rem);

	// Editing shows the dashboard as saved; otherwise as this session shows it.
	const { dashboard, away } = React.useMemo(() => {
		const view = onScreen(saved, screen);

		return editing ? { dashboard: view, away: new Set<string>() } : forSession(view, shownKind);
	}, [editing, saved, screen, shownKind]);

	const stacked = width < STACK_BELOW_REM * 16;
	const rows = Math.max(1, ...dashboard.layout.map((place) => place.y + place.h));
	const gap = GAP_REM * rem;
	const rowGap = (editing ? EDIT_ROW_GAP_REM : GAP_REM) * rem;
	// Editing pads the grid top and bottom so the first row's bars have room.
	const padding = editing ? rowGap : 0;
	// Tiles keep their height while editing; only the gaps between rows open up.
	const rowHeight = rowPitch(height, rows, gap, rem) - gap;

	const tiles = new Map(dashboard.tiles.map((tile) => [tile.id, tile]));
	const heights = new Map(dashboard.layout.map((place) => [place.i, place.h]));

	// Minimum sizes come from the tile kind, so the grid enforces them while resizing.
	const layout = React.useMemo<Layout>(() => {
		const kinds = new Map(dashboard.tiles.map((tile) => [tile.id, tile.kind]));

		return dashboard.layout.flatMap((place) => {
			const kind = kinds.get(place.i);

			return kind
				? [
						{
							...place,
							minW: TILE_INFO[kind].min.w,
							minH: away.has(place.i) ? place.h : TILE_INFO[kind].min.h
						}
					]
				: [];
		});
	}, [dashboard, away]);

	const onLayoutChange = (next: Layout) => {
		if (!editing || sameLayout(dashboard, next)) {
			return;
		}

		onChange(
			withPlacements(
				saved,
				screen,
				next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
			)
		);
	};

	if (dashboard.tiles.length === 0) {
		return (
			<div ref={containerRef} className="text-muted-foreground border border-dashed p-8 text-sm">
				{editing
					? 'This dashboard is empty. Add a tile to start.'
					: 'This dashboard is empty. Open the menu, then Add tile.'}
			</div>
		);
	}

	// Wait for the width so tiles mount once, in the right mode, and nothing replays.
	if (!mounted) {
		return <div ref={containerRef} className="min-h-svh" />;
	}

	if (stacked) {
		const ordered = stackOrder(dashboard);

		return (
			<div ref={containerRef} className="flex flex-col gap-4" data-testid="dashboard-stack">
				{saved.tiles.some((tile) => tile.kind === 'replay') ? null : (
					// The bar on a phone has no room for the transport; it heads the stack instead, and the
					// bar keeps the live key.
					<Transport className="sm:hidden" live={false} />
				)}
				{ordered.map((tile, index) => (
					<div
						key={tile.id}
						className="flex min-w-0 flex-col"
						data-tile-id={tile.id}
						data-testid={`tile-${tile.kind}`}
					>
						<TileBar
							dashboard={saved}
							screen={screen}
							tile={tile}
							editing={editing}
							neighbours={{ up: ordered[index - 1]?.id, down: ordered[index + 1]?.id }}
							onChange={onChange}
						/>
						<TileBody
							dashboard={saved}
							rows={null}
							tile={tile}
							fill={false}
							away={away.has(tile.id)}
							editing={editing}
							onChange={onChange}
						/>
					</div>
				))}
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			data-testid="dashboard-grid"
			data-screen={screen}
			data-editing={editing || undefined}
		>
			<ReactGridLayout
				width={width}
				layout={layout}
				gridConfig={{
					cols: GRID_COLUMNS,
					rowHeight,
					margin: [gap, rowGap],
					// Room above the first row for the tile bars, which sit in the gaps.
					containerPadding: [0, padding]
				}}
				dragConfig={{
					enabled: editing,
					handle: '[data-tile-handle]',
					cancel: 'button:not([data-tile-grip])'
				}}
				resizeConfig={{ enabled: editing, handles: ['se', 'e', 's'] }}
				onLayoutChange={onLayoutChange}
			>
				{dashboard.layout.flatMap((place) => {
					const tile = tiles.get(place.i);

					return tile
						? [
								<div
									key={tile.id}
									// Chrome counts a tall tile's scrolled content in the page height; the bar
									// that floats above a tile in edit mode must not be clipped.
									className={cn('flex min-w-0 flex-col', !editing && 'overflow-clip')}
									data-tile-id={tile.id}
									data-testid={`tile-${tile.kind}`}
								>
									<TileBar
										dashboard={saved}
										screen={screen}
										tile={tile}
										editing={editing}
										floating
										onChange={onChange}
									/>
									<TileBody
										dashboard={saved}
										rows={heights.get(tile.id) ?? null}
										tile={tile}
										fill
										away={away.has(tile.id)}
										editing={editing}
										onChange={onChange}
									/>
								</div>
							]
						: [];
				})}
			</ReactGridLayout>
		</div>
	);
}
