import type { Driver, RaceSnapshot } from '@f1-live/shared';
import type { GapSettings } from '@f1-live/shared/dashboard';
import { DownloadIcon, LockIcon } from 'lucide-react';
import * as React from 'react';

import { BRAND, brandSlug } from '@/brand';
import { Key, KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useRace } from '@/data/race-context';
import { useGoPro } from '@/features/account/go-pro';
import type { GapField } from '@/insights/gap-distance';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import { CARD_SIZES, type CardSize, gapCardBlob, readCardTheme } from './gap-card';
import { GapStraight } from './gap-straight';
import { defaultGapView, type GapView, gapViews, topOf, useGapFields } from './use-gap-field';

const VIEW_LABEL: Record<GapView, string> = {
	q1: 'Q1',
	q2: 'Q2',
	q3: 'Q3',
	best: 'Best',
	race: 'Race'
};

const FIELD_OPTIONS = [
	{ value: 'top10', label: 'Top 10' },
	{ value: 'all', label: 'All' }
] as const;

const SPLIT_OPTIONS = [
	{ value: 'lap', label: 'Lap' },
	{ value: 'sectors', label: 'Sectors' }
] as const;

/** What the straight measures, in one line under it. */
function measuredBy(view: GapView, estimated: boolean): string {
	if (view === 'race') {
		return 'Each car behind the leader by its gap, run at the leader’s speed over its last lap.';
	}

	return `Each car behind the fastest by the distance it still had to run when that car crossed the line, from its own telemetry${estimated ? '; ~ marks an estimate from its speed over the line' : ''}.`;
}

/** "Qualifying gaps", "Race gaps", "Fastest laps". */
function cardTitle(snapshot: RaceSnapshot, view: GapView): string {
	if (view === 'race') {
		return 'Race gaps';
	}

	return snapshot.session.type === 'qualifying' || snapshot.session.type === 'sprint_qualifying'
		? 'Qualifying gaps'
		: 'Fastest laps';
}

function sessionLine(snapshot: RaceSnapshot, view: GapView, lap: number): string {
	const year = snapshot.session.startsAt.slice(0, 4);
	const base = `${snapshot.session.meetingName} ${year}, ${snapshot.session.name}`;

	if (view === 'race') {
		return `${base}, lap ${lap}`;
	}

	return view === 'best' ? base : `${base}, ${VIEW_LABEL[view]}`;
}

/** Every car on one straight, behind pole by the distance its gap is worth. */
export function GapsTile({
	settings,
	onSettingsChange
}: {
	settings?: GapSettings;
	onSettingsChange?: (settings: GapSettings) => void;
}) {
	const fill = useTileFill();

	return (
		<Panel
			aria-label="Gap distance"
			className={cn('flex min-h-0 flex-col', fill && 'h-full')}
			data-testid="gap-distance"
		>
			<GapsBody settings={settings ?? {}} onSettingsChange={onSettingsChange} />
		</Panel>
	);
}

function GapsBody({
	settings,
	onSettingsChange
}: {
	settings: GapSettings;
	onSettingsChange?: (settings: GapSettings) => void;
}) {
	const { race, snapshot, lap, followedDriver } = useRace();
	const fill = useTileFill();
	const views = gapViews(snapshot);
	const [local, setLocal] = React.useState(settings);
	const chosen = { ...settings, ...local };
	const view = chosen.view && views.includes(chosen.view) ? chosen.view : defaultGapView(views);
	const split = view === 'race' ? 'lap' : (chosen.split ?? 'lap');
	const fields = useGapFields(view);
	const many = fields.field.cars.length > 10;
	const top = chosen.field ?? (view === 'q1' || view === 'race' ? 'all' : 'top10');
	const count = many && top === 'top10' ? 10 : null;
	const field = topOf(fields.field, count);

	const drivers = React.useMemo(
		() => new Map(race.drivers.map((driver) => [driver.number, driver])),
		[race.drivers]
	);

	const change = (next: GapSettings) => {
		setLocal((current) => ({ ...current, ...next }));
		onSettingsChange?.({ ...chosen, ...next });
	};

	const estimated = field.cars.some((car) => car.estimated && car.position > 1);
	const bodyClass = fill ? 'min-h-64 flex-1' : 'h-[36rem] @3xl:h-[28rem]';
	const label = `${cardTitle(snapshot, view)}: ${field.cars.length} cars on a straight`;

	return (
		<>
			<PanelHeader title="Gap distance" meta={VIEW_LABEL[view]}>
				{views.length > 1 ? (
					<KeyGroup
						label="Field"
						options={views.map((value) => ({ value, label: VIEW_LABEL[value] }))}
						value={view}
						onChange={(value) => change({ view: value })}
					/>
				) : null}
				{many ? (
					<KeyGroup
						label="Cars"
						options={FIELD_OPTIONS}
						value={top}
						onChange={(value) => change({ field: value })}
					/>
				) : null}
				{view === 'race' ? null : (
					<KeyGroup
						label="Split"
						options={SPLIT_OPTIONS}
						value={split}
						onChange={(value) => change({ split: value })}
					/>
				)}
				<ExportKey
					field={field}
					drivers={drivers}
					title={cardTitle(snapshot, view)}
					subtitle={sessionLine(snapshot, view, lap)}
					note={measuredBy(view, estimated)}
					fileName={`${brandSlug()}-${cardTitle(snapshot, view).toLowerCase().replaceAll(' ', '-')}-${snapshot.session.id}`}
				/>
			</PanelHeader>
			{field.cars.length === 0 ? (
				<p className="text-muted-foreground px-4 py-6 text-sm" data-testid="gap-empty">
					{view === 'race' ? 'No gaps yet: the race has not run a lap.' : 'No timed laps yet.'}
				</p>
			) : split === 'sectors' && fields.sectors ? (
				<div
					className={cn('grid min-h-0 grid-cols-1 @3xl:grid-cols-3', bodyClass)}
					data-testid="gap-sectors"
				>
					{fields.sectors.map(({ sector, field: sectorField }) => (
						<section
							key={sector}
							className="flex min-h-48 flex-col border-b @3xl:border-r @3xl:border-b-0"
						>
							<h3 className="type-label px-4 pt-2">Sector {sector}</h3>
							<GapStraight
								field={topOf(sectorField, count)}
								drivers={drivers}
								orientation="auto"
								followed={followedDriver}
								labelStyle="compact"
								label={`Sector ${sector}: who loses where, in metres`}
							/>
						</section>
					))}
				</div>
			) : (
				<div className={cn('flex min-h-0', bodyClass)}>
					<GapStraight
						field={field}
						drivers={drivers}
						orientation="auto"
						followed={followedDriver}
						label={label}
					/>
				</div>
			)}
			<p className="text-muted-foreground border-t px-4 py-2 text-xs" data-testid="gap-note">
				{split === 'sectors'
					? 'In each sector, every car behind the quickest through it by the time it lost there, at that sector’s average speed.'
					: measuredBy(view, estimated)}
			</p>
		</>
	);
}

/** Saves the straight as a picture at a social size: Pro. */
function ExportKey({
	field,
	drivers,
	title,
	subtitle,
	note,
	fileName
}: {
	field: GapField;
	drivers: ReadonlyMap<string, Driver>;
	title: string;
	subtitle: string;
	note: string;
	fileName: string;
}) {
	const { plan } = useRace();
	const goPro = useGoPro();
	const [busy, setBusy] = React.useState(false);

	async function save(size: CardSize) {
		setBusy(true);

		try {
			const blob = await gapCardBlob(size, {
				field,
				drivers,
				title,
				subtitle,
				note,
				brand: BRAND.name,
				site: BRAND.origin.replace(/^https?:\/\//, ''),
				theme: readCardTheme(document.documentElement)
			});

			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');

			link.href = url;
			link.download = `${fileName}-${size.width}x${size.height}.png`;
			link.click();
			window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
		} finally {
			setBusy(false);
		}
	}

	if (plan !== 'pro') {
		return (
			<Key onClick={goPro} title="Share cards are part of Pro" data-testid="gap-export-locked">
				<LockIcon />
				Share
			</Key>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Key disabled={busy || field.cars.length === 0} data-testid="gap-export">
					<DownloadIcon />
					Share
				</Key>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					<span className="type-label">Save a picture</span>
				</DropdownMenuLabel>
				{CARD_SIZES.map((size) => (
					<DropdownMenuItem key={size.id} onSelect={() => void save(size)}>
						{size.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
