import { ArrowLeftIcon, LockIcon, PlusIcon, UploadIcon } from 'lucide-react';
import * as React from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Key } from '@/components/console/keys';
import { useRace } from '@/data/race-context';
import { DashboardGrid } from '@/features/dashboard/dashboard-grid';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import {
	type Dashboard,
	GRID_COLUMNS,
	isPreset,
	PRESETS,
	TILE_INFO
} from '@/features/dashboard/dashboards';
import { dashboardPath } from '@/features/dashboard/paths';
import { FREE_OWN_DASHBOARDS, useAddDashboard } from '@/features/dashboard/use-add-dashboard';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { cn } from '@/lib/utils';

import { AccountDialog } from './account';
import { COMMUNITY, type LibraryEntry } from './community';
import { accountStore, publishDashboard, unpublishDashboard, usePublished } from './library-data';
import { decodeShare } from './share';

/** A dashboard's layout drawn to scale: how it sits on a wide screen, before opening it. */
function LayoutThumb({ dashboard, className }: { dashboard: Dashboard; className?: string }) {
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

function LibraryRow({
	dashboard,
	by,
	description,
	tags = NO_TAGS,
	adds,
	children
}: {
	dashboard: Dashboard;
	by?: string;
	description?: string;
	tags?: readonly string[];
	adds?: number;
	children: React.ReactNode;
}) {
	const pro = dashboard.tiles.some((tile) => TILE_INFO[tile.kind].pro);

	return (
		<li
			className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b py-3"
			data-testid="library-row"
		>
			<LayoutThumb dashboard={dashboard} />
			<div className="flex min-w-48 flex-1 flex-col gap-1">
				<span className="flex flex-wrap items-baseline gap-x-3">
					<span className="type-wide text-sm font-bold">{dashboard.name}</span>
					{by ? <span className="type-label">by @{by}</span> : null}
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
					<span className="text-sm font-bold">{adds.toLocaleString('en')}</span>
					<span className="type-label">adds</span>
				</span>
			)}
			<span className="flex shrink-0 gap-2">{children}</span>
		</li>
	);
}

function Section({
	title,
	meta,
	children
}: {
	title: string;
	meta?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section aria-label={title} className="flex flex-col">
			<header className="border-rule-strong flex flex-wrap items-baseline gap-x-4 border-b-2 pb-1.5">
				<h2 className="type-wide text-xs font-bold">{title}</h2>
				{meta ? <span className="type-label">{meta}</span> : null}
			</header>
			<ul className="grid 2xl:grid-cols-2 2xl:gap-x-10">{children}</ul>
		</section>
	);
}

/**
 * Every dashboard there is to open or add: the viewer's own, the ready-made ones, and ones other
 * fans published. Adding copies a dashboard; nothing changes for whoever shared it.
 */
export function LibraryPage() {
	const search = useCarriedSearch();
	const { plan, setPlan } = useRace();
	const { dashboards } = useDashboards();
	const published = usePublished();
	const account = accountStore.useValue();
	const add = useAddDashboard();
	const [signingIn, setSigningIn] = React.useState(false);
	const own = dashboards.filter((dashboard) => !isPreset(dashboard.id));
	const fans = [...published, ...COMMUNITY];

	return (
		<div className="flex flex-col gap-8" data-testid="library">
			<header className="flex flex-col gap-2">
				<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">Library</h1>
				<p className="text-muted-foreground max-w-2xl text-sm">
					Ready-made dashboards and ones other fans built. Open one as it is, or add a copy to make
					it yours: move, resize and swap any tile, then share it with a link.
				</p>
			</header>
			<Section
				title="Yours"
				meta={
					plan === 'pro'
						? `${own.length} of any number`
						: `${own.length} of ${FREE_OWN_DASHBOARDS} on Free`
				}
			>
				{own.length === 0 ? (
					<li className="text-muted-foreground border-b py-3 text-sm">
						Nothing yet. Add one below, or start from an empty dashboard with the + key in the bar.
					</li>
				) : null}
				{own.map((dashboard) => {
					const entry = published.find((item) => item.dashboard.id === dashboard.id);

					return (
						<LibraryRow key={dashboard.id} dashboard={dashboard}>
							<Key
								onClick={() => {
									if (!account) {
										setSigningIn(true);

										return;
									}

									if (!entry && plan === 'free') {
										toast('Publishing is part of Pro', {
											description: 'Share links work on Free; the library lists Pro dashboards.',
											action: { label: 'Preview Pro', onClick: () => setPlan('pro') }
										});

										return;
									}

									if (entry) {
										unpublishDashboard(entry.id);
										toast(`${dashboard.name} is no longer in the library`);
									} else {
										publishDashboard(dashboard, account);
										toast(`${dashboard.name} is in the library`, {
											description: 'Fans can preview it and add a copy.'
										});
									}
								}}
							>
								<UploadIcon />
								{entry ? 'Unpublish' : 'Publish'}
							</Key>
							<Link
								to={{ pathname: dashboardPath(dashboard.id), search }}
								className="type-label hover:text-foreground inline-flex h-9 items-center border border-b-2 px-2.5 sm:h-7"
							>
								Open
							</Link>
						</LibraryRow>
					);
				})}
			</Section>
			<Section title="Ready-made" meta="Edit any of them; Reset brings it back">
				{PRESETS.map((preset) => (
					<LibraryRow key={preset.id} dashboard={preset}>
						<Link
							to={{ pathname: dashboardPath(preset.id), search }}
							className="type-label hover:text-foreground inline-flex h-9 items-center border border-b-2 px-2.5 sm:h-7"
						>
							Open
						</Link>
					</LibraryRow>
				))}
			</Section>
			<Section title="From fans" meta="Sample entries until the library has a server">
				{fans.map((entry) => (
					<LibraryRow
						key={entry.id}
						dashboard={entry.dashboard}
						by={entry.author}
						description={entry.description}
						tags={entry.tags}
						adds={entry.adds}
					>
						<Link
							to={{ pathname: `/library/${encodeURIComponent(entry.id)}`, search }}
							className="type-label hover:text-foreground inline-flex h-9 items-center border border-b-2 px-2.5 sm:h-7"
						>
							Preview
						</Link>
						<Key
							aria-label={`Add ${entry.dashboard.name}`}
							onClick={() => {
								if (add(entry.dashboard)) {
									toast(`Added ${entry.dashboard.name} to your dashboards`);
								}
							}}
						>
							<PlusIcon />
							Add
						</Key>
					</LibraryRow>
				))}
			</Section>
			<AccountDialog open={signingIn} onOpenChange={setSigningIn} />
		</div>
	);
}

/** A dashboard someone else made, live but read-only, with one key to add a copy. */
function DashboardPreview({ entry }: { entry: Omit<LibraryEntry, 'id'> | null }) {
	const search = useCarriedSearch();
	const add = useAddDashboard();

	if (!entry) {
		return (
			<div className="text-muted-foreground border border-dashed p-8 text-sm" role="alert">
				This link does not hold a dashboard. Ask for a fresh one, or{' '}
				<Link to={{ pathname: '/library', search }} className="underline">
					browse the library
				</Link>
				.
			</div>
		);
	}

	return (
		<div data-testid="dashboard-preview">
			<section aria-label="Preview" className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4">
				<Link
					to={{ pathname: '/library', search }}
					aria-label="Back to the library"
					className="type-label hover:text-foreground inline-flex h-9 items-center border border-b-2 px-2 sm:h-7"
				>
					<ArrowLeftIcon aria-hidden className="size-3.5" />
				</Link>
				<h1 className="type-wide text-sm font-bold">{entry.dashboard.name}</h1>
				<span className="type-label">
					{entry.author ? `Preview, by @${entry.author}` : 'Preview, shared with you'}
				</span>
				<Key
					pressed
					className="ml-auto"
					onClick={() => {
						if (add(entry.dashboard)) {
							toast(`Added ${entry.dashboard.name} to your dashboards`);
						}
					}}
				>
					<PlusIcon />
					Add to my dashboards
				</Key>
			</section>
			<DashboardGrid dashboard={entry.dashboard} editing={false} onChange={() => undefined} />
		</div>
	);
}

export function LibraryEntryPage() {
	const { entryId } = useParams();
	const published = usePublished();
	const entry = [...published, ...COMMUNITY].find((item) => item.id === entryId) ?? null;

	return <DashboardPreview entry={entry} />;
}

/** /shared?d=…: a dashboard carried whole in its link. */
export function SharedPage() {
	const [searchParams] = useSearchParams();
	const code = searchParams.get('d');
	const dashboard = code ? decodeShare(code) : null;

	return (
		<DashboardPreview
			entry={dashboard ? { author: '', description: '', tags: [], adds: 0, dashboard } : null}
		/>
	);
}
