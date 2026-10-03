import {
	TRACK_STATUSES,
	type Driver,
	type Lap,
	type Overtake,
	type RaceSnapshot,
	type TrackStatus,
	type TyreCompound
} from '@f1-live/shared';

import { minuteTime, type SessionClock, sessionClock } from '../data/snapshot-at-time.ts';
import { isCleanLap } from './clean-laps.ts';
import { isTimedSession } from './qualifying.ts';

/** The ribbon's lanes, top to bottom. */
export const STORY_LANES = [
	'flags',
	'lead',
	'passes',
	'stops',
	'penalties',
	'out',
	'radio'
] as const;

export type StoryLane = (typeof STORY_LANES)[number];

export const STORY_LANE_LABEL: Record<StoryLane, string> = {
	flags: 'Flags',
	lead: 'Lead',
	passes: 'Passes',
	stops: 'Stops',
	penalties: 'Penalties',
	out: 'Out',
	radio: 'Radio'
};

/** What a mark is drawn as: a flag state, the compound fitted at a stop, or a kind of moment. */
export type StoryTone =
	TrackStatus | TyreCompound | 'fastest' | 'lead' | 'pass' | 'danger' | 'radio';

export interface StoryMark {
	/** Stable while the replay moves: the lane and the mark's place in it. */
	id: string;
	lane: StoryLane;
	/** The lap of a race, or the minute of a session on the clock. */
	step: number;
	driverNumber?: string;
	text: string;
	tone: StoryTone;
	/** A radio clip's place in the archive. */
	clip?: string;
}

/** A mark before it is numbered in its lane. */
type Mark = Omit<StoryMark, 'id'>;

const FLAG_TEXT: Record<Exclude<TrackStatus, 'green'>, string> = {
	yellow: 'Yellow flag',
	vsc: 'Virtual Safety Car',
	safety_car: 'Safety Car',
	red: 'Red flag'
};

const COMPOUND_WORD: Record<TyreCompound, string> = {
	SOFT: 'softs',
	MEDIUM: 'mediums',
	HARD: 'hards',
	INTERMEDIATE: 'intermediates',
	WET: 'wets',
	UNKNOWN: 'new tyres'
};

const MINUTE_MS = 60_000;

/** "CAR 1 (VER) LAP DELETED - TRACK LIMITS AT TURN 14 LAP 2 20:03:28" and its time variant. */
const DELETED_LAP = /\bDELETED\b(?: - (TRACK LIMITS AT TURN \d+))?/;

function severity(status: TrackStatus): number {
	return TRACK_STATUSES.indexOf(status);
}

/** Running order at the end of each lap, by driver; lap 0 is the starting grid. */
function ordersByLap(snapshot: RaceSnapshot): Map<number, Map<string, number>> {
	const orders = new Map<number, Map<string, number>>([
		[0, new Map(snapshot.startingGrid.map((slot) => [slot.driverNumber, slot.position]))]
	]);

	for (const lap of snapshot.laps) {
		const order = orders.get(lap.lap) ?? new Map<string, number>();

		order.set(lap.driverNumber, lap.position);
		orders.set(lap.lap, order);
	}

	return orders;
}

export interface ClassifiedPass {
	pass: Overtake;
	/** False when every car it went by was in the pits or had stopped. */
	onTrack: boolean;
	/** The car passed, when the order tells exactly one. */
	passed: string | null;
}

/**
 * The feed counts a pass at the timing loops, also of a car in the pit lane. A pass counts as made
 * on track unless every car that fell behind on that lap was stopping or had retired.
 */
export function classifyPasses(snapshot: RaceSnapshot): ClassifiedPass[] {
	const orders = ordersByLap(snapshot);
	const passes = snapshot.overtakes ?? [];

	const stopped = (driverNumber: string, lap: number) =>
		snapshot.pitStops.some(
			(stop) => stop.driverNumber === driverNumber && (stop.lap === lap || stop.lap === lap - 1)
		) ||
		snapshot.retirements.some(
			(retirement) => retirement.driverNumber === driverNumber && retirement.lap <= lap
		);

	return passes.map((pass) => {
		const before = orders.get(pass.lap - 1);
		const after = orders.get(pass.lap);
		const from = before?.get(pass.driverNumber);
		const to = after?.get(pass.driverNumber);

		if (from === undefined || to === undefined || !before || !after) {
			return { pass, onTrack: true, passed: null };
		}

		const behindNow = [...before].flatMap(([driverNumber, position]) => {
			const now = after.get(driverNumber);

			return position < from && (now === undefined || now > to) ? [driverNumber] : [];
		});

		const onTrack = behindNow.filter((driverNumber) => !stopped(driverNumber, pass.lap));

		const sameLap = passes.filter(
			(other) => other.driverNumber === pass.driverNumber && other.lap === pass.lap
		);

		return {
			pass,
			onTrack: behindNow.length === 0 || onTrack.length > 0,
			passed: onTrack.length === 1 && sameLap.length === 1 ? (onTrack[0] ?? null) : null
		};
	});
}

/** Where on the ribbon a moment goes: its lap in a race, its minute on the clock. */
type Placer = { step: (lap: number, at: string | undefined) => number | null };

function lapPlacer(): Placer {
	return { step: (lap) => lap };
}

function minutePlacer(startMs: number): Placer {
	return {
		step: (_, at) =>
			at === undefined ? null : Math.max(1, Math.ceil((Date.parse(at) - startMs) / MINUTE_MS))
	};
}

/**
 * The most serious flag on each step: per lap in a race; per minute on the clock, each status held
 * until the next change, starting from the one in force at the start.
 */
function flagMarks(snapshot: RaceSnapshot, clock: SessionClock | null): Mark[] {
	const worst = new Map<number, TrackStatus>();

	if (clock) {
		const log = (snapshot.trackStatusLog ?? []).toSorted((a, b) => a.at.localeCompare(b.at));

		// Nobody completes a lap under a red flag, so the flags run as far as anything known.
		const latest = Math.max(
			minuteTime(clock, clock.minutes),
			...log.map((change) => Date.parse(change.at)),
			...(snapshot.statusLog ?? []).map((change) => Date.parse(change.at)),
			...snapshot.raceControl.flatMap((message) => (message.at ? [Date.parse(message.at)] : []))
		);

		const minutes = Math.ceil((latest - clock.startMs) / MINUTE_MS);

		for (let minute = 1; minute <= minutes; minute++) {
			const from = minuteTime(clock, minute - 1);
			const to = minuteTime(clock, minute);
			let status: TrackStatus = 'green';

			for (const change of log) {
				const at = Date.parse(change.at);

				if (at <= from) {
					status = change.status;
				} else if (at < to && severity(change.status) > severity(status)) {
					status = change.status;
				}
			}

			worst.set(minute, status);
		}
	} else {
		for (const lap of snapshot.laps) {
			if (severity(lap.trackStatus) > severity(worst.get(lap.lap) ?? 'green')) {
				worst.set(lap.lap, lap.trackStatus);
			}
		}
	}

	return [...worst].flatMap(([step, status]): Mark[] =>
		status === 'green' ? [] : [{ lane: 'flags', step, text: FLAG_TEXT[status], tone: status }]
	);
}

function fastest(lapTimeMs: number): string {
	return `fastest lap, ${(lapTimeMs / 1000).toFixed(3)} s`;
}

/**
 * A race's lead changes and the fastest lap that stands; on the clock, each new best lap of the
 * session, which is what decides practice and qualifying.
 */
function leadMarks(snapshot: RaceSnapshot, place: Placer, code: (number: string) => string) {
	const marks: Mark[] = [];

	if (isTimedSession(snapshot.session.type)) {
		let best = Infinity;

		const flying = snapshot.laps
			.filter((lap) => lap.lapTimeMs > 0 && !lap.pitIn && !lap.pitOut)
			.toSorted((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));

		for (const lap of flying) {
			const step = place.step(lap.lap, lap.completedAt);

			if (lap.lapTimeMs < best && step !== null) {
				best = lap.lapTimeMs;
				marks.push({
					lane: 'lead',
					step,
					driverNumber: lap.driverNumber,
					text: `${code(lap.driverNumber)} ${fastest(lap.lapTimeMs)}`,
					tone: 'fastest'
				});
			}
		}

		return marks;
	}

	let leader: string | null = null;

	for (const lap of snapshot.laps) {
		if (lap.position === 1 && lap.driverNumber !== leader) {
			marks.push({
				lane: 'lead',
				step: lap.lap,
				driverNumber: lap.driverNumber,
				text:
					leader === null
						? `${code(lap.driverNumber)} leads`
						: `${code(lap.driverNumber)} takes the lead from ${code(leader)}`,
				tone: 'lead'
			});
			leader = lap.driverNumber;
		}
	}

	const best = snapshot.laps.reduce<Lap | null>(
		(quickest, lap) =>
			lap.lap > 1 && isCleanLap(lap) && (!quickest || lap.lapTimeMs < quickest.lapTimeMs)
				? lap
				: quickest,
		null
	);

	if (best) {
		marks.push({
			lane: 'lead',
			step: best.lap,
			driverNumber: best.driverNumber,
			text: `${code(best.driverNumber)} ${fastest(best.lapTimeMs)}`,
			tone: 'fastest'
		});
	}

	return marks;
}

/**
 * Every moment the ribbon shows, in lanes: flags, lead changes and fastest laps, passes made on
 * track, stops with the tyres fitted, penalties, cars out and radio clips. Races place them by
 * lap, practice and qualifying by minute from the start.
 */
export function storyMarks(snapshot: RaceSnapshot): StoryMark[] {
	const timed = isTimedSession(snapshot.session.type);
	const sessionStart = sessionClock(snapshot);
	const clock = timed ? sessionStart : null;
	const startMs = sessionStart.startMs;
	const place = clock ? minutePlacer(startMs) : lapPlacer();

	const drivers = new Map<string, Driver>(
		snapshot.drivers.map((driver) => [driver.number, driver])
	);

	const code = (number: string) => drivers.get(number)?.code ?? number;

	const lapEnd = (driverNumber: string, lap: number) =>
		snapshot.laps.find((entry) => entry.driverNumber === driverNumber && entry.lap === lap)
			?.completedAt;

	const marks: Mark[] = [...flagMarks(snapshot, clock), ...leadMarks(snapshot, place, code)];

	if (!timed) {
		for (const { pass, onTrack, passed } of classifyPasses(snapshot)) {
			if (onTrack) {
				marks.push({
					lane: 'passes',
					step: pass.lap,
					driverNumber: pass.driverNumber,
					text: passed
						? `${code(pass.driverNumber)} passes ${code(passed)}`
						: `${code(pass.driverNumber)} passes ${pass.count > 1 ? `${pass.count} cars` : 'a car'}`,
					tone: 'pass'
				});
			}
		}

		for (const stop of snapshot.pitStops) {
			const fitted = snapshot.stints.find(
				(stint) => stint.driverNumber === stop.driverNumber && stint.startLap === stop.lap + 1
			);

			const still =
				stop.stationaryMs === undefined ? '' : `, ${(stop.stationaryMs / 1000).toFixed(1)} s still`;

			marks.push({
				lane: 'stops',
				step: stop.lap,
				driverNumber: stop.driverNumber,
				text: `${code(stop.driverNumber)} stops for ${COMPOUND_WORD[fitted?.compound ?? 'UNKNOWN']}${still}`,
				tone: fitted?.compound ?? 'UNKNOWN'
			});
		}
	}

	for (const penalty of snapshot.penalties ?? []) {
		const step = place.step(penalty.lap, lapEnd(penalty.driverNumber, penalty.lap));

		const what =
			penalty.kind === 'time'
				? `${penalty.seconds ?? 0} s penalty`
				: penalty.kind === 'drive_through'
					? 'drive-through'
					: penalty.kind === 'stop_go'
						? 'stop-and-go'
						: penalty.kind === 'grid'
							? `${penalty.places ?? 0}-place grid penalty`
							: 'reprimand';

		if (step !== null) {
			marks.push({
				lane: 'penalties',
				step,
				driverNumber: penalty.driverNumber,
				text: `${code(penalty.driverNumber)} ${what}, ${penalty.reason.toLowerCase()}`,
				tone: 'danger'
			});
		}
	}

	if (!snapshot.penalties) {
		for (const message of snapshot.raceControl) {
			const step = place.step(message.lap, message.at);

			if (message.category === 'penalty' && step !== null) {
				marks.push({
					lane: 'penalties',
					step,
					driverNumber: message.driverNumber,
					text: message.message,
					tone: 'danger'
				});
			}
		}
	}

	for (const message of snapshot.raceControl) {
		const step = place.step(message.lap, message.at);
		const deleted = DELETED_LAP.exec(message.message);

		if (timed && deleted && step !== null) {
			marks.push({
				lane: 'penalties',
				step,
				driverNumber: message.driverNumber,
				text: `${message.driverNumber ? code(message.driverNumber) : 'A car'} lap deleted${deleted[1] ? `, ${deleted[1].toLowerCase()}` : ''}`,
				tone: 'danger'
			});
		}
	}

	for (const retirement of snapshot.retirements) {
		const step = place.step(retirement.lap, retirement.at);

		if (step !== null) {
			marks.push({
				lane: 'out',
				step,
				driverNumber: retirement.driverNumber,
				text: `${code(retirement.driverNumber)} out, ${retirement.reason.toLowerCase()}`,
				tone: 'danger'
			});
		}
	}

	const lastStep = Math.max(1, ...marks.map((mark) => mark.step), timed ? 1 : snapshot.currentLap);

	for (const correction of snapshot.corrections ?? []) {
		if (correction.kind === 'disqualified') {
			marks.push({
				lane: 'out',
				step: lastStep,
				driverNumber: correction.driverNumber,
				text: `${code(correction.driverNumber)} disqualified after the session, ${correction.reason.toLowerCase()}`,
				tone: 'danger'
			});
		}
	}

	for (const clip of snapshot.teamRadio ?? []) {
		const step = place.step(clip.lap, clip.at);

		// Clips from before the start are about the grid, not the session.
		if (step !== null && Date.parse(clip.at) >= startMs) {
			marks.push({
				lane: 'radio',
				step,
				driverNumber: clip.driverNumber,
				text: `${code(clip.driverNumber)} team radio`,
				tone: 'radio',
				clip: clip.path
			});
		}
	}

	// Each lane counts its marks in the order they happened, so a mark keeps its id as the
	// replay moves on and more are added.
	const counts = new Map<StoryLane, number>();

	return marks
		.map((mark) => {
			const count = counts.get(mark.lane) ?? 0;

			counts.set(mark.lane, count + 1);

			return { ...mark, id: `${mark.lane}-${count}` };
		})
		.toSorted(
			(a, b) => a.step - b.step || STORY_LANES.indexOf(a.lane) - STORY_LANES.indexOf(b.lane)
		);
}
