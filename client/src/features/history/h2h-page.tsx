import type { SeasonResults } from '@f1-live/shared/results';
import { DownloadIcon, LinkIcon, LockIcon } from 'lucide-react';
import * as React from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { BRAND, brandSlug } from '@/brand';
import { Key, KeyGroup } from '@/components/console/keys';
import { LoadingState } from '@/components/site-frame';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useRace } from '@/data/race-context';
import { useSeasonResults } from '@/data/results-context';
import { useGoPro } from '@/features/account/go-pro';
import { h2hFacts } from '@/insights/h2h-facts';
import {
	H2H_PRESETS,
	type H2HPreset,
	type H2HRange,
	headToHead,
	hiddenSessions,
	presetRange,
	type RoundRef,
	sharedEvents,
	type Side
} from '@/insights/head-to-head';
import { plural } from '@/lib/format';

import { Breakdown, EventList, Facts, GapTrend, Scoreboard } from './h2h-sections';
import {
	type Contender,
	contenderOf,
	ContenderPicker,
	contenders,
	defaultPair,
	type H2HMode
} from './h2h-picker';
import {
	countedSeasons,
	HiddenNote,
	includedKeys,
	PageTitle,
	useHistoryFilter,
	useSearchUpdate,
	useYears
} from './history-data';

const MODES = [
	{ value: 'drivers', label: 'Drivers' },
	{ value: 'teams', label: 'Teams' }
] as const satisfies readonly { value: H2HMode; label: string }[];

const PRESET_LABEL: Record<H2HPreset, string> = {
	teammates: 'As teammates',
	season: 'This season',
	career: 'Career overlap'
};

function tally(value: { a: number; b: number }) {
	return { a: String(value.a), b: String(value.b) };
}

function readRef(text: string | null): RoundRef | null {
	const match = /^(\d{4})\.(\d{1,2})$/.exec(text ?? '');

	return match ? { season: Number(match[1]), round: Number(match[2]) } : null;
}

function writeRef(ref: RoundRef): string {
	return `${ref.season}.${ref.round}`;
}

/** Every round of the loaded seasons, as range choices. */
function roundChoices(seasons: readonly SeasonResults[]) {
	return seasons.flatMap((season) =>
		season.rounds.map((round) => ({
			value: writeRef({ season: season.season, round: round.round }),
			label: `${season.season} R${round.round} ${round.name.replace(/ Grand Prix$/, '')}`
		}))
	);
}

/** One end of the range, as a select of rounds. */
function RangeEnd({
	label,
	value,
	choices,
	onChange
}: {
	label: string;
	value: RoundRef;
	choices: readonly { value: string; label: string }[];
	onChange: (ref: RoundRef) => void;
}) {
	return (
		<label className="flex min-w-0 items-center gap-2">
			<span className="type-label">{label}</span>
			<Select value={writeRef(value)} onValueChange={(text) => onChange(readRef(text) ?? value)}>
				<SelectTrigger size="sm" aria-label={label === 'From' ? 'From round' : 'To round'}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{choices.toReversed().map((choice) => (
						<SelectItem key={choice.value} value={choice.value}>
							{choice.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</label>
	);
}

/**
 * `/h2h`: any two drivers, or teams, over a range of rounds from 2018 on. Totals as a scoreboard,
 * the qualifying gap over time, a breakdown by season or circuit, generated facts that link to
 * their sessions, and every shared weekend opening its compare view. Results the viewer has not
 * seen yet are left out until revealed.
 */
export function HeadToHeadPage() {
	const years = useYears();
	const state = useSeasonResults(years);
	const [params] = useSearchParams();
	const set = useSearchUpdate();
	const { followedDriver, plan } = useRace();
	const goPro = useGoPro();
	const counts = useHistoryFilter();
	const mode: H2HMode = params.get('mode') === 'teams' ? 'teams' : 'drivers';
	const seasons = React.useMemo(() => (state.status === 'ready' ? state.seasons : []), [state]);
	const include = React.useMemo(() => includedKeys(seasons, counts), [seasons, counts]);
	const counted = React.useMemo(() => countedSeasons(seasons, include), [seasons, include]);
	const list = React.useMemo(() => contenders(counted, mode), [counted, mode]);
	const fallback = mode === 'drivers' ? defaultPair(counted, followedDriver) : null;
	const idA = params.get('a') ?? fallback?.[0] ?? list[0]?.id ?? null;
	const idB = params.get('b') ?? fallback?.[1] ?? list[1]?.id ?? null;
	const listedA = contenderOf(list, idA);
	const listedB = contenderOf(list, idB);

	const sides = React.useMemo(
		(): { a: Side; b: Side } | null =>
			idA && idB
				? {
						a: { kind: mode === 'drivers' ? 'driver' : 'team', id: idA },
						b: { kind: mode === 'drivers' ? 'driver' : 'team', id: idB }
					}
				: null,
		[mode, idA, idB]
	);

	const askedPreset = H2H_PRESETS.find((preset) => preset === params.get('preset'));
	const defaultPreset: H2HPreset = mode === 'drivers' ? 'teammates' : 'career';

	const presetRanges = React.useMemo(
		() =>
			new Map(
				H2H_PRESETS.map((preset) => [
					preset,
					sides ? presetRange(counted, sides.a, sides.b, preset) : null
				])
			),
		[counted, sides]
	);

	const from = readRef(params.get('from'));
	const to = readRef(params.get('to'));

	const preset =
		from && to
			? null
			: (askedPreset ?? (presetRanges.get(defaultPreset) ? defaultPreset : 'career'));

	const fromKey = from ? writeRef(from) : null;
	const toKey = to ? writeRef(to) : null;

	const range = React.useMemo(
		(): H2HRange | null =>
			from && to ? { from, to } : preset ? (presetRanges.get(preset) ?? null) : null,
		// from/to are rebuilt from the URL each render; their text keys are the stable inputs.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[fromKey, toKey, preset, presetRanges]
	);

	const events = React.useMemo(
		() => (sides && range ? sharedEvents(seasons, sides.a, sides.b, range, include) : []),
		[seasons, sides, range, include]
	);

	// A driver wears the colour of the team they drove for in the range, not their latest team.
	const colourIn = (side: 'a' | 'b', listed: Contender | null) => {
		const event = events.find((entry) => entry.race ?? entry.qualifying);
		const team = (event?.race ?? event?.qualifying)?.[side][0]?.team;
		const colour = seasons.find((season) => season.season === event?.season)?.teams[team ?? ''];

		return listed && mode === 'drivers' && colour ? { ...listed, colour } : listed;
	};

	const a = colourIn('a', listedA);
	const b = colourIn('b', listedB);

	const totals = React.useMemo(() => (sides ? headToHead(events, sides) : null), [events, sides]);
	const hidden = sides && range ? hiddenSessions(seasons, sides.a, sides.b, range, include) : [];

	const lastName = (label: string | undefined) =>
		mode === 'drivers' ? (label?.split(' ').at(-1) ?? '') : (label ?? '');

	const facts = totals
		? h2hFacts(events, totals, { a: lastName(a?.label), b: lastName(b?.label) })
		: [];

	const choices = roundChoices(seasons);

	const share = async () => {
		const url = new URL(window.location.href);

		if (range) {
			url.searchParams.set('from', writeRef(range.from));
			url.searchParams.set('to', writeRef(range.to));
		}

		url.searchParams.set('a', idA ?? '');
		url.searchParams.set('b', idB ?? '');

		await navigator.clipboard.writeText(url.toString()).catch(() => undefined);
		toast('Link copied', { description: 'It opens this comparison and range.' });
	};

	// The share card (Pro) reuses the gap card's frame and fonts; it loads when first used.
	const saveCard = async () => {
		if (!totals || !a || !b || !range) {
			return;
		}

		const [{ h2hCardBlob }, { CARD_SIZES, readCardTheme }] = await Promise.all([
			import('./h2h-card'),
			import('@/features/gaps/gap-card')
		]);

		const size = CARD_SIZES[0];

		const blob = await h2hCardBlob(size, {
			a: { name: a.label, colour: a.colour },
			b: { name: b.label, colour: b.colour },
			subtitle: `${writeRef(range.from)} to ${writeRef(range.to)}, ${plural(totals.racesTogether, 'race')} together`,
			rows: [
				{ label: 'Qualifying', ...tally(totals.qualifying) },
				{ label: 'Race', ...tally(totals.race) },
				{ label: 'Wins', ...tally({ a: totals.a.wins, b: totals.b.wins }) },
				{ label: 'Podiums', ...tally({ a: totals.a.podiums, b: totals.b.podiums }) },
				{ label: 'Poles', ...tally({ a: totals.a.poles, b: totals.b.poles }) },
				{ label: 'DNFs', ...tally({ a: totals.a.dnfs, b: totals.b.dnfs }) },
				{ label: 'Points', a: String(totals.a.points), b: String(totals.b.points) }
			],
			fact: facts[0]?.text ?? null,
			brand: BRAND.name,
			site: BRAND.origin.replace(/^https?:\/\//, ''),
			theme: readCardTheme(document.documentElement)
		});

		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');

		link.href = url;
		link.download = `${brandSlug()}-h2h-${idA}-${idB}-${size.width}x${size.height}.png`;
		link.click();
		window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
	};

	return (
		<div className="flex flex-col gap-6" data-testid="h2h-page">
			<PageTitle title="Head to head">
				Any two drivers or teams since 2018, over any range of rounds. Qualifying counts the higher
				grid slot; a race counts the better finish when at least one of them was classified.
			</PageTitle>
			<section aria-label="Who and when" className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<KeyGroup
						label="Compare"
						options={MODES}
						value={mode}
						onChange={(value) =>
							set({
								mode: value === 'drivers' ? null : value,
								a: null,
								b: null,
								from: null,
								to: null,
								preset: null
							})
						}
					/>
					<span className="ml-auto flex gap-2">
						{plan === 'pro' ? (
							<Key onClick={() => void saveCard()} disabled={!totals} data-testid="h2h-card">
								<DownloadIcon aria-hidden />
								Card
							</Key>
						) : (
							<Key
								onClick={goPro}
								title="Share cards are part of Pro"
								data-testid="h2h-card-locked"
							>
								<LockIcon aria-hidden />
								Card
							</Key>
						)}
						<Key onClick={() => void share()}>
							<LinkIcon aria-hidden />
							Copy link
						</Key>
					</span>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row">
					<ContenderPicker
						label="First"
						seasons={counted}
						list={list}
						mode={mode}
						value={a}
						other={idB}
						onChange={(id) => set({ a: id, from: null, to: null })}
					/>
					<ContenderPicker
						label="Second"
						seasons={counted}
						list={list}
						mode={mode}
						value={b}
						other={idA}
						onChange={(id) => set({ b: id, from: null, to: null })}
					/>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<fieldset aria-label="Range" className="flex flex-wrap">
						{H2H_PRESETS.map((entry, index) => (
							<Key
								key={entry}
								aria-pressed={preset === entry}
								pressed={preset === entry}
								disabled={!presetRanges.get(entry)}
								onClick={() => set({ preset: entry, from: null, to: null })}
								className={index > 0 ? '-ml-px' : undefined}
							>
								{PRESET_LABEL[entry]}
							</Key>
						))}
					</fieldset>
					{range && choices.length > 0 ? (
						<>
							<RangeEnd
								label="From"
								value={range.from}
								choices={choices}
								onChange={(ref) =>
									set({ from: writeRef(ref), to: writeRef(range.to), preset: null })
								}
							/>
							<RangeEnd
								label="To"
								value={range.to}
								choices={choices}
								onChange={(ref) =>
									set({ from: writeRef(range.from), to: writeRef(ref), preset: null })
								}
							/>
						</>
					) : null}
				</div>
			</section>
			<HiddenNote sessions={hidden} />
			{state.status === 'loading' ? <LoadingState label="Loading results" /> : null}
			{state.status === 'error' ? (
				<p className="text-muted-foreground text-sm" role="alert">
					The results could not be loaded: {state.message}
				</p>
			) : null}
			{state.status === 'ready' && totals && events.length === 0 ? (
				<p className="text-muted-foreground border-y py-3 text-sm" data-testid="h2h-empty">
					{a?.label ?? 'They'} and {b?.label ?? 'the other'} never took part in the same session in
					this range.
				</p>
			) : null}
			{a && b && sides && totals && events.length > 0 ? (
				<div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
					<div className="flex flex-col gap-6">
						<Scoreboard totals={totals} pair={{ a, b }} sides={sides} />
						<GapTrend totals={totals} pair={{ a, b }} />
					</div>
					<div className="flex flex-col gap-6">
						<Facts facts={facts} />
						<Breakdown events={events} sides={sides} pair={{ a, b }} />
						<EventList events={events} pair={{ a, b }} />
					</div>
				</div>
			) : null}
		</div>
	);
}
