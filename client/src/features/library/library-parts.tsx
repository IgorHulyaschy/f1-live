import { LockIcon } from 'lucide-react';
import type * as React from 'react';

import { type Dashboard, GRID_COLUMNS, TILE_INFO } from '@/features/dashboard/dashboards';
import { cn } from '@/lib/utils';

/** A dashboard's layout drawn to scale: how it sits on a wide screen, before opening it. */
/** A link drawn as a key, for the actions of a library row. */
export const LINK_KEY =
	'type-label hover:text-foreground inline-flex h-9 items-center border border-b-2 px-2.5 sm:h-7';

export function LayoutThumb({
	dashboard,
	className
}: {
	dashboard: Dashboard;
	className?: string;
}) {
	const rows = Math.max(1, ...dashboard.layout.map((place) => place.y + place.h));
	const kinds = new Map(dashboard.tiles.map((tile) => [tile.id, tile.kind]));

	return (
		<svg
			aria-hidden
			viewBox={`0 0 ${GRID_COLUMNS} ${rows}`}
			preserveAspectRatio="none"
			className={cn('bg-muted/40 aspect-video w-24 shrink-0 border sm:w-36', className)}
		>
			{dashboard.layout.map((place) => {
				const kind = kinds.get(place.i);
				const pro = kind ? TILE_INFO[kind].pro : false;

				return (
					<rect
						key={place.i}
						x={place.x + 0.3}
						y={place.y + 0.3}
						width={Math.max(place.w - 0.6, 0.2)}
						height={Math.max(place.h - 0.6, 0.2)}
						vectorEffect="non-scaling-stroke"
						strokeDasharray={pro ? '3 2' : undefined}
						className={cn(
							'stroke-foreground/50 stroke-1',
							kind && TILE_INFO[kind].group === 'Race' ? 'fill-foreground/5' : 'fill-foreground/20',
							pro && 'fill-transparent'
						)}
					/>
				);
			})}
		</svg>
	);
}

const NO_TAGS: readonly string[] = [];

export function LibraryRow({
	dashboard,
	by,
	description,
	tags = NO_TAGS,
	adds,
	badge,
	children
}: {
	dashboard: Dashboard;
	by?: string;
	description?: string;
	tags?: readonly string[];
	adds?: number;
	/** A note beside the name, such as "Example" or "Held back". */
	badge?: string;
	children: React.ReactNode;
}) {
	const pro = dashboard.tiles.some((tile) => TILE_INFO[tile.kind].pro);

	return (
		<li
			className="flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-3 border-b py-3"
			data-testid="library-row"
		>
			<LayoutThumb dashboard={dashboard} />
			<div className="flex min-w-48 flex-1 flex-col gap-1">
				<span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
					<span className="type-wide max-w-full truncate text-sm font-bold">{dashboard.name}</span>
					{by ? <span className="type-label">by @{by}</span> : null}
					{badge ? <span className="type-label border px-1">{badge}</span> : null}
				</span>
				{description ? (
					<span className="text-muted-foreground max-w-xl text-sm">{description}</span>
				) : null}
				<span className="flex flex-wrap gap-x-3 gap-y-1">
					<span className="type-label">{dashboard.tiles.length} tiles</span>
					{tags.map((tag) => (
						<span key={tag} className="type-label">
							{tag}
						</span>
					))}
					{pro ? (
						<span className="type-label flex items-center gap-1">
							<LockIcon aria-hidden className="size-2.5" />
							Uses Pro tiles
						</span>
					) : null}
				</span>
			</div>
			{adds === undefined ? null : (
				<span className="flex flex-col font-mono sm:w-20 sm:items-end">
					<span className="text-sm font-bold">{adds.toLocaleString()}</span>
					<span className="type-label">adds</span>
				</span>
			)}
			<span className="flex shrink-0 gap-2">{children}</span>
		</li>
	);
}

export function Section({
	title,
	meta,
	controls,
	children
}: {
	title: string;
	meta?: React.ReactNode;
	/** Search and filters, between the heading and the list. */
	controls?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section aria-label={title} className="flex flex-col">
			<header className="border-rule-strong flex flex-wrap items-baseline gap-x-4 border-b-2 pb-1.5">
				<h2 className="type-wide text-xs font-bold">{title}</h2>
				{meta ? <span className="type-label">{meta}</span> : null}
			</header>
			{controls}
			<ul className="grid 2xl:grid-cols-2 2xl:gap-x-10">{children}</ul>
		</section>
	);
}
