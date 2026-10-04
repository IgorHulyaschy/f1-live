import type { Subject } from '@f1-live/shared/ask';
import type { RaceSnapshot, TrackStatus } from '@f1-live/shared';
import type { ResultRow, SessionResults } from '@f1-live/shared/results';

import { type StoryMark, storyMarks } from '../../insights/race-story.ts';
import { formatLapTime } from '../../lib/format.ts';
import { type FlagRange, flagRanges } from '../analysis/lap-series.ts';
import { labelOf } from './ask-context.ts';
import {
	type AskData,
	type AskSessionInfo,
	plural,
	type Rich,
	sessionHref,
	sessionLabel
} from './ask-data.ts';
import type { AskOutcome } from './answers.ts';

export type StoryMarkerKind = 'stop' | 'penalty' | 'incident' | 'out';

export type StoryMarker = { lap: number; kind: StoryMarkerKind; label: string };

/** One thing that happened, with the view of that lap that shows it. */
export type StoryMoment = { when: string; href: string; text: string };

/** The running order lap by lap, with what happened to the car along it. */
export type StoryVisual = {
	kind: 'story';
	/** The race distance, laps; the line's right edge. */
	laps: number;
	/** Cars on the grid; the line's bottom edge. */
	field: number;
	colour: string | null;
	/** Position at the end of each lap; lap 0 is the grid. */
	positions: { lap: number; position: number }[];
	/** Safety cars and red flags, which are what move a race around. */
	bands: FlagRange[];
	markers: StoryMarker[];
	moments: StoryMoment[];
};

type Candidate = StoryMoment & { lap: number; priority: number };

/** Moments shown at most: enough to tell the race, few enough to read in one go. */
const MOMENT_LIMIT = 6;

const REASON_TEXT = new Map([
	['Stopped', 'stopped on track'],
	['Retired', 'retired']
]);

const UNDER: Partial<Record<TrackStatus, string>> = {
	yellow: 'under yellow flags',
	vsc: 'under the Virtual Safety Car',
	safety_car: 'behind the Safety Car',
	red: 'under a red flag'
};

/** A race control message as a sentence: the feed shouts, and puts a time at the end. */
function sentence(message: string): string {
	return message
		.replace(/\s*\(\d\d:\d\d:\d\d\)/, '')
		.toLowerCase()
		.replace(/^./, (first) => first.toUpperCase())
		.replaceAll(/\bfia\b/g, 'FIA')
		.replaceAll(/\(([a-z]{3})\)/g, (_, code: string) => `(${code.toUpperCase()})`)
		.replaceAll(/\bturn (\d+)/g, 'Turn $1');
}

function reasonText(reason: string): string {
	return REASON_TEXT.get(reason) ?? reason.toLowerCase();
}

/** What race control said on a lap about the track: yellow flags, marshals at a corner. */
function sceneAt(snapshot: RaceSnapshot, lap: number) {
	const messages = snapshot.raceControl.filter((message) => message.lap === lap);

	const marshals = messages.find((message) => message.message.startsWith('MARSHALS ON TRACK'));

	return {
		yellow: messages.some(
			(message) => /YELLOW/.test(message.message) && !/CLEAR/.test(message.message)
		),
		marshals: marshals
			? sentence(marshals.message).replace(/^./, (first) => first.toLowerCase())
			: null
	};
}

function markerOf(mark: StoryMark): StoryMarker | null {
	const kind: StoryMarkerKind | null =
		mark.lane === 'stops'
			? 'stop'
			: mark.lane === 'penalties'
				? 'penalty'
				: mark.lane === 'out'
					? 'out'
					: null;

	return kind ? { lap: mark.step, kind, label: mark.text } : null;
}

/**
 * The story of one driver in a race or sprint: how it ended in words, the running order lap by lap
 * and the few moments that decided it. The outcome comes from the classification, which knows
 * retirements and the laps rule; the rest from the saved data of the session.
 */
export function storyAnswer(
	data: AskData,
	info: AskSessionInfo,
	results: SessionResults,
	row: ResultRow,
	snapshot: RaceSnapshot
): AskOutcome {
	const season = data.seasons.find((entry) => entry.season === info.season);
	const label = sessionLabel(info);
	const name = labelOf(data.context, 'driver', row.driver);
	const total = results.leaderLaps || results.scheduledLaps || snapshot.session.totalLaps || 0;
	const href = (lap?: number) => sessionHref(info.key, row.number, lap);
	const place = { text: `P${row.position}`, href: href() };
	const laps = { text: `${row.laps} of ${plural(total, 'lap')}`, href: href(row.laps) };
	const retirement = row.retirement;

	const grid =
		row.grid ?? snapshot.startingGrid.find((slot) => slot.driverNumber === row.number)?.position;

	const marks = storyMarks(snapshot).filter((mark) => mark.driverNumber === row.number);

	const stops = marks.filter((mark) => mark.lane === 'stops');

	const lap = (number: number) =>
		snapshot.laps.find((entry) => entry.driverNumber === row.number && entry.lap === number);

	const scene = retirement ? sceneAt(snapshot, retirement.lap) : null;

	const headline: Rich = (() => {
		const car = { text: name, href: href() };

		switch (row.status) {
			case 'dnf': {
				return [
					car,
					...(retirement
						? [
								' retired on ',
								{ text: `lap ${retirement.lap}`, href: href(retirement.lap) },
								`: ${reasonText(retirement.reason)}${scene?.yellow ? ' under yellow flags' : ''}, `
							]
						: [' retired, ']),
					...(row.classified
						? ['still classified ', place, ' with ', laps]
						: ['not classified (', laps, ')'])
				];
			}

			case 'dsq': {
				const ruling = snapshot.corrections?.find(
					(correction) =>
						correction.driverNumber === row.number && correction.kind === 'disqualified'
				);

				return [
					car,
					` was disqualified from the ${label}${ruling ? `: ${ruling.reason.toLowerCase()}` : ''}`
				];
			}

			case 'dns': {
				return [car, ` did not start the ${label}`];
			}

			case 'nc': {
				return [car, ` finished the ${label} but was not classified, `, laps];
			}

			default: {
				return [
					car,
					' finished ',
					place,
					...(grid ? [` from P${grid} on the grid`] : []),
					` in the ${label}`
				];
			}
		}
	})();

	const candidates: Candidate[] = [];

	if (grid) {
		candidates.push({
			lap: 0,
			priority: 4,
			when: 'Start',
			href: href(1),
			text: `Started P${grid}.`
		});
	} else if (row.status !== 'dns') {
		candidates.push({
			lap: 0,
			priority: 4,
			when: 'Start',
			href: href(1),
			text: 'Started from the pit lane.'
		});
	}

	for (const mark of stops) {
		candidates.push({
			lap: mark.step,
			priority: 5,
			when: `Lap ${mark.step}`,
			href: href(mark.step),
			text: `${sentence(mark.text.replace(/^\S+ /, ''))}.`
		});
	}

	for (const mark of marks.filter((entry) => entry.lane === 'penalties')) {
		candidates.push({
			lap: mark.step,
			priority: 2,
			when: `Lap ${mark.step}`,
			href: href(mark.step),
			text: `${sentence(mark.text.replace(/^\S+ /, ''))}.`
		});
	}

	const incidents = snapshot.raceControl.filter(
		(message) => message.category === 'incident' && message.driverNumber === row.number
	);

	for (const message of incidents) {
		candidates.push({
			lap: message.lap,
			priority: 2,
			when: `Lap ${message.lap}`,
			href: href(message.lap),
			text: `${sentence(message.message)}.`
		});
	}

	const best = row.fastestLap
		? snapshot.laps.find(
				(entry) => entry.driverNumber === row.number && entry.lapTimeMs === row.bestLapMs
			)
		: undefined;

	if (best && row.bestLapMs) {
		candidates.push({
			lap: best.lap,
			priority: 3,
			when: `Lap ${best.lap}`,
			href: href(best.lap),
			text: `Fastest lap of the race, ${formatLapTime(row.bestLapMs)}.`
		});
	}

	if (row.status === 'dnf' && retirement) {
		const last = lap(row.laps);
		const status = last ? UNDER[last.trackStatus] : undefined;

		if (last && row.laps >= 1) {
			candidates.push({
				lap: last.lap,
				priority: 2,
				when: `Lap ${last.lap}`,
				href: href(last.lap),
				text: `Running P${last.position}${status ? ` ${status}` : ''}, the last lap completed.`
			});
		}

		const around = [
			...(scene?.yellow ? ['yellow flags'] : []),
			...(scene?.marshals ? [scene.marshals] : [])
		];

		candidates.push({
			lap: retirement.lap,
			priority: 1,
			when: `Lap ${retirement.lap}`,
			href: href(retirement.lap),
			text: `Out, ${reasonText(retirement.reason)}${around.length > 0 ? `: ${around.join(', ')}` : ''}.`
		});
	} else if (row.status === 'finished' || row.status === 'nc') {
		candidates.push({
			lap: row.laps,
			priority: 1,
			when: `Lap ${row.laps}`,
			href: href(row.laps),
			text: `Took the flag in P${row.position}${row.points > 0 ? `, ${plural(row.points, 'point')}` : ''}.`
		});
	}

	const moments = candidates
		.toSorted((a, b) => a.priority - b.priority || a.lap - b.lap)
		.slice(0, MOMENT_LIMIT)
		.toSorted((a, b) => a.lap - b.lap || a.priority - b.priority)
		.map(({ when, href: to, text }) => ({ when, href: to, text }));

	const positions = [
		...(grid ? [{ lap: 0, position: grid }] : []),
		...snapshot.laps
			.filter((entry) => entry.driverNumber === row.number)
			.toSorted((a, b) => a.lap - b.lap)
			.map((entry) => ({ lap: entry.lap, position: entry.position }))
	];

	const markers: StoryMarker[] = [
		...marks.flatMap((mark) => markerOf(mark) ?? []),
		...incidents.map((message): StoryMarker => ({
			lap: message.lap,
			kind: 'incident',
			label: message.message
		}))
	];

	const detail = `${[
		grid ? `Started P${grid}` : 'Started from the pit lane',
		plural(stops.length, 'stop'),
		...(row.bestLapMs ? [`best lap ${formatLapTime(row.bestLapMs)}`] : [])
	].join(', ')}.`;

	return {
		kind: 'answer',
		headline,
		detail: [detail],
		visual: {
			kind: 'story',
			laps: Math.max(total, ...positions.map((point) => point.lap), retirement?.lap ?? 0),
			field: Math.max(snapshot.drivers.length, ...positions.map((point) => point.position)),
			colour: season?.teams[row.team] ?? null,
			positions,
			bands: flagRanges(snapshot).filter((range) => range.status !== 'yellow'),
			markers,
			moments
		},
		source: `${label}${total ? `, ${plural(total, 'lap')}` : ''}`,
		proof: { label: 'Open the session', href: href(retirement?.lap ?? row.laps) },
		hidden: []
	};
}

/** The driver of a question about one driver, from the classification. */
export function storyRow(results: SessionResults, subject: Subject): ResultRow | undefined {
	return results.rows.find((row) => subject.kind === 'driver' && row.driver === subject.id);
}
