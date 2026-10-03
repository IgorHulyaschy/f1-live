import { TYRE_COMPOUNDS } from '@f1-live/shared';
import type {
	Driver,
	Penalty,
	PenaltyKind,
	PenaltyStatus,
	PersonalBest,
	RaceControlCategory,
	RaceEvent,
	Session,
	SessionStatus,
	SessionType,
	TrackStatus,
	TyreCompound,
	TyresFittedEvent
} from '@f1-live/shared';
import { z } from 'zod';

/** One message of the official timing feed: a full or partial update of one topic. */
export interface TopicFrame {
	topic: string;
	/** The payload as published; the decoder parses it. */
	data: unknown;
	/** When it was published, in milliseconds since the Unix epoch. */
	timestamp: number;
}

/** The topics the decoder reads, for recorders and the archive reader. */
export const F1_TOPICS = [
	'SessionInfo',
	'SessionStatus',
	'DriverList',
	'LapCount',
	'TrackStatus',
	'TimingData',
	'TimingAppData',
	'TyreStintSeries',
	'TimingStats',
	'DriverRaceInfo',
	'PitLaneTimeCollection',
	'PitStopSeries',
	'RaceControlMessages',
	'WeatherData'
] as const;

/** Collections keyed by racing number or index, without the feed's `_kf` and `_deleted` markers. */
function keyed<T extends z.ZodType>(item: T) {
	return z.record(z.string(), z.unknown()).transform((record, context) => {
		const entries: [string, z.output<T>][] = [];

		for (const [key, entry] of Object.entries(record)) {
			const parsed = key.startsWith('_') ? null : item.safeParse(entry);

			if (parsed?.success) {
				entries.push([key, parsed.data]);
			} else if (parsed) {
				context.issues.push({
					code: 'custom',
					input: entry,
					path: [key],
					message: z.prettifyError(parsed.error)
				});
			}
		}

		return entries;
	});
}

/** Lists arrive as arrays in full updates and as objects keyed by index in partial ones. */
function indexed<T extends z.ZodType>(item: T) {
	return z.union([
		z.array(item).transform((items) => items.map((value, index) => [index, value] as const)),
		keyed(item).transform((entries) => entries.map(([key, value]) => [Number(key), value] as const))
	]);
}

const value = z.object({ Value: z.string() }).partial();

const sessionInfoSchema = z
	.object({
		Key: z.number(),
		Type: z.string(),
		Name: z.string(),
		StartDate: z.string(),
		GmtOffset: z.string(),
		Meeting: z.object({
			Name: z.string(),
			Country: z.object({ Code: z.string() }),
			Circuit: z.object({ ShortName: z.string() })
		})
	})
	.partial();

const sessionStatusSchema = z.object({ Status: z.string() }).partial();

const driverListSchema = keyed(
	z
		.object({
			Tla: z.string(),
			FullName: z.string(),
			FirstName: z.string(),
			LastName: z.string(),
			TeamName: z.string(),
			TeamColour: z.string(),
			HeadshotUrl: z.string(),
			PublicIdRight: z.string()
		})
		.partial()
);

const lapCountSchema = z.object({ TotalLaps: z.number() }).partial();

const trackStatusSchema = z.object({ Status: z.string() }).partial();

const timingDataSchema = z
	.object({
		Lines: keyed(
			z
				.object({
					Position: z.string(),
					GapToLeader: z.string(),
					IntervalToPositionAhead: value,
					TimeDiffToFastest: z.string(),
					TimeDiffToPositionAhead: z.string(),
					NumberOfLaps: z.number(),
					InPit: z.boolean(),
					Retired: z.boolean(),
					LastLapTime: value,
					Sectors: indexed(value)
				})
				.partial()
		)
	})
	.partial();

const stintSchema = z
	.object({ Compound: z.string(), StartLaps: z.number(), TotalLaps: z.number() })
	.partial();

const timingAppDataSchema = z
	.object({
		Lines: keyed(z.object({ GridPos: z.string(), Stints: indexed(stintSchema) }).partial())
	})
	.partial();

const tyreStintSeriesSchema = z.object({ Stints: keyed(indexed(stintSchema)) }).partial();

const timingStatsSchema = z
	.object({
		Lines: keyed(
			z
				.object({
					PersonalBestLapTime: z.object({ Value: z.string(), Lap: z.number() }).partial(),
					BestSectors: indexed(value),
					BestSpeeds: z.object({ I1: value, I2: value, FL: value, ST: value }).partial()
				})
				.partial()
		)
	})
	.partial();

const driverRaceInfoSchema = keyed(z.object({ IsOut: z.boolean() }).partial());

const pitLaneTimeCollectionSchema = z
	.object({ PitTimes: keyed(z.object({ Duration: z.string(), Lap: z.string() }).partial()) })
	.partial();

const pitStopSeriesSchema = z
	.object({
		PitTimes: keyed(
			indexed(
				z
					.object({
						PitStop: z
							.object({ PitStopTime: z.string(), PitLaneTime: z.string(), Lap: z.string() })
							.partial()
					})
					.partial()
			)
		)
	})
	.partial();

const raceControlMessagesSchema = z
	.object({
		Messages: indexed(
			z
				.object({
					Lap: z.number(),
					Category: z.string(),
					Message: z.string(),
					RacingNumber: z.string()
				})
				.partial()
		)
	})
	.partial();

const weatherDataSchema = z
	.object({
		AirTemp: z.string(),
		TrackTemp: z.string(),
		Humidity: z.string(),
		WindSpeed: z.string(),
		Rainfall: z.string()
	})
	.partial();

type StintUpdate = z.output<typeof stintSchema>;

type DriverFields = z.output<typeof driverListSchema>[number][1];

type WeatherFields = z.output<typeof weatherDataSchema>;

const SESSION_STATUS_BY_FEED: ReadonlyMap<string, SessionStatus> = new Map([
	['Inactive', 'inactive'],
	['Started', 'started'],
	['Aborted', 'aborted'],
	['Finished', 'finished'],
	['Finalised', 'finalised'],
	['Ends', 'ended']
]);

const TRACK_STATUS_BY_CODE: ReadonlyMap<string, TrackStatus> = new Map([
	['1', 'green'],
	['2', 'yellow'],
	['4', 'safety_car'],
	['5', 'red'],
	['6', 'vsc'],
	['7', 'vsc']
]);

const DURATION = /^\+?(?:(\d+):)?(\d+(?:\.\d+)?)$/;

/** "1:33.365", "+20.741" or "37.4" in milliseconds; null for an empty value or a gap in laps. */
export function parseDuration(text: string): number | null {
	const match = DURATION.exec(text.trim());

	if (!match) {
		return null;
	}

	return Math.round((Number(match[1] ?? 0) * 60 + Number(match[2])) * 1000);
}

/** The leader's gap reads "LAP 12"; a lapped car's "1L", which is not a time. */
function parseGap(text: string, position: number): number | null {
	return position === 1 || text.startsWith('LAP') ? 0 : parseDuration(text);
}

function parseNumber(text: string | undefined): number | null {
	const parsed = text === undefined || text.trim() === '' ? Number.NaN : Number(text);

	return Number.isFinite(parsed) ? parsed : null;
}

function compoundOf(text: string): TyreCompound {
	return TYRE_COMPOUNDS.find((compound) => compound === text) ?? 'UNKNOWN';
}

export function sessionTypeOf(type: string, name: string): SessionType {
	const sprint = name.toLowerCase().includes('sprint');

	if (type === 'Race') {
		return sprint ? 'sprint' : 'race';
	}

	if (type === 'Qualifying') {
		return sprint ? 'sprint_qualifying' : 'qualifying';
	}

	return 'practice';
}

/** Local start "2025-11-22T20:00:00" with offset "-08:00:00" in UTC. */
export function utcStart(startDate: string, gmtOffset: string): string {
	const offset = /^[+-]/.test(gmtOffset) ? gmtOffset : `+${gmtOffset}`;

	return new Date(`${startDate}${offset.slice(0, 6)}`).toISOString();
}

const RACE_CONTROL_CAR = /CARS? (\d+) \(/;

function raceControlCategory(category: string, message: string): RaceControlCategory {
	if (category === 'Flag') {
		return 'flag';
	}

	if (category === 'SafetyCar') {
		return 'safety_car';
	}

	if (category === 'Drs' || message.startsWith('DRS ')) {
		return 'drs';
	}

	if (/PENALTY|REPRIMAND/.test(message)) {
		return 'penalty';
	}

	return message.includes('INCIDENT') ? 'incident' : 'other';
}

const PENALTY_PATTERNS: readonly (readonly [PenaltyKind, RegExp])[] = [
	['time', /(?<amount>\d+) SECOND TIME PENALTY FOR CAR (?<car>\d+)/],
	['stop_go', /(?<amount>\d+) SECOND STOP\/GO PENALTY FOR CAR (?<car>\d+)/],
	['drive_through', /DRIVE THROUGH PENALTY FOR CAR (?<car>\d+)/],
	['grid', /(?<amount>\d+) PLACE GRID PENALTY FOR CAR (?<car>\d+)/],
	['reprimand', /REPRIMAND\b.*? FOR CAR (?<car>\d+)/]
];

const PENALTY_REASON = / FOR CAR \d+(?: \([A-Z]+\))? - (.+)$/;

/** A stewards' decision in a race control message, as the FIA words them. */
function parsePenalty(message: string, lap: number): Omit<Penalty, 'servedLap'> | null {
	for (const [kind, pattern] of PENALTY_PATTERNS) {
		const groups = pattern.exec(message)?.groups;
		const driverNumber = groups?.car;

		if (driverNumber === undefined) {
			continue;
		}

		const penalty: Omit<Penalty, 'servedLap'> = {
			driverNumber,
			kind,
			reason: PENALTY_REASON.exec(message)?.[1] ?? '',
			lap,
			status: penaltyStatus(message)
		};

		const amount = parseNumber(groups?.amount);

		if (amount !== null && kind === 'grid') {
			penalty.places = amount;
		} else if (amount !== null) {
			penalty.seconds = amount;
		}

		return penalty;
	}

	return null;
}

function penaltyStatus(message: string): PenaltyStatus {
	if (message.includes('PENALTY SERVED')) {
		return 'served';
	}

	return /REVOKED|CANCELLED|RESCINDED|WITHDRAWN/.test(message) ? 'revoked' : 'issued';
}

/** What the decoder has merged of one car's TimingData line. */
interface TimingLine {
	position: string;
	gapToLeader: string;
	interval: string;
	lapsCompleted: number;
	inPit: boolean;
	sectors: [string, string, string];
	lastLapTime: string;
	/** A new last lap time published since the previous crossing. */
	pendingLapTime: string | null;
	pitEntry: { lap: number; timestamp: number } | null;
	lastPitEntryLap: number | null;
}

interface StintEntry {
	compound: string | undefined;
	tyreAgeAtStart: number;
	/** Laps on the set so far, those before the stint included. */
	tyreAge: number;
	startLap: number;
	sent: string;
}

interface BestEntry {
	lapTime: string;
	lap: number | null;
	sectors: [string, string, string];
	speeds: { I1: string; I2: string; FL: string; ST: string };
	sent: string;
}

/** Some sessions list the field without teams: the driver still enters, with a neutral grey. */
const UNKNOWN_TEAM = '';

const UNKNOWN_TEAM_COLOUR = '808080';

/** "Max VERSTAPPEN" as "Max" and "Verstappen"; the surname is the words in capitals. */
function namesFromFullName(fullName: string): { firstName: string; lastName: string } | null {
	const words = fullName.trim().split(/\s+/);
	const surnameAt = words.findIndex((word) => word.length > 1 && word === word.toUpperCase());

	if (surnameAt === -1) {
		return null;
	}

	return {
		firstName: words.slice(0, surnameAt).join(' '),
		lastName: words
			.slice(surnameAt)
			.map((word) => word.charAt(0) + word.slice(1).toLowerCase())
			.join(' ')
	};
}

/** The feed's own first and last name, or those read from FullName when it lists only that. */
function driverNames(fields: DriverFields): { firstName: string; lastName: string } | null {
	if (fields.FirstName !== undefined && fields.LastName !== undefined) {
		return { firstName: fields.FirstName, lastName: fields.LastName };
	}

	return fields.FullName === undefined ? null : namesFromFullName(fields.FullName);
}

/**
 * Turns frames of the official timing feed, archived or live, into race events. The feed sends
 * partial updates, so the decoder keeps what it has merged of each topic; feed one session's
 * frames in time order to one decoder.
 */
export class F1Decoder {
	private started = false;
	private sessionStatus: SessionStatus | null = null;
	private trackStatus: TrackStatus | null = null;
	private totalLaps: number | null = null;
	private sessionInfo: z.output<typeof sessionInfoSchema> = {};
	private sessionSent = '';
	private weather: WeatherFields = {};
	private readonly drivers = new Map<string, DriverFields>();
	private readonly driversSent = new Map<string, string>();
	private readonly lines = new Map<string, TimingLine>();
	private readonly grid = new Map<string, number>();
	private readonly stints = new Map<string, Map<number, StintEntry>>();
	private readonly bests = new Map<string, BestEntry>();
	private readonly retired = new Set<string>();
	private readonly publishedStops = new Set<string>();
	private readonly stopsWithSeries = new Set<string>();
	private readonly raceControlSeen = new Set<number>();

	/** Throws when a frame of a topic it reads does not match the feed's known format. */
	decode(frame: TopicFrame): RaceEvent[] {
		const at = new Date(frame.timestamp).toISOString();

		switch (frame.topic) {
			case 'SessionInfo':
				return this.onSessionInfo(parse(sessionInfoSchema, frame), at);
			case 'SessionStatus':
				return this.onSessionStatus(parse(sessionStatusSchema, frame), at);
			case 'DriverList':
				return this.onDriverList(parse(driverListSchema, frame), at);
			case 'LapCount':
				return this.onLapCount(parse(lapCountSchema, frame), at);
			case 'TrackStatus':
				return this.onTrackStatus(parse(trackStatusSchema, frame), at);
			case 'TimingData':
				return this.onTimingData(parse(timingDataSchema, frame), at, frame.timestamp);
			case 'TimingAppData':
				return this.onTimingAppData(parse(timingAppDataSchema, frame), at);
			case 'TyreStintSeries':
				return (parse(tyreStintSeriesSchema, frame).Stints ?? []).flatMap(
					([driverNumber, stints]) => this.onStints(driverNumber, stints, at)
				);
			case 'TimingStats':
				return this.onTimingStats(parse(timingStatsSchema, frame), at);
			case 'DriverRaceInfo':
				return parse(driverRaceInfoSchema, frame).flatMap(([driverNumber, info]) =>
					info.IsOut ? this.retire(driverNumber, at) : []
				);
			case 'PitLaneTimeCollection':
				return this.onPitLaneTimes(parse(pitLaneTimeCollectionSchema, frame), at);
			case 'PitStopSeries':
				return this.onPitStopSeries(parse(pitStopSeriesSchema, frame), at);
			case 'RaceControlMessages':
				return this.onRaceControl(parse(raceControlMessagesSchema, frame), at);
			case 'WeatherData':
				return this.onWeather(parse(weatherDataSchema, frame), at);
			default:
				return [];
		}
	}

	private onSessionInfo(update: z.output<typeof sessionInfoSchema>, at: string): RaceEvent[] {
		this.sessionInfo = { ...this.sessionInfo, ...update };

		const { Key, Type, Name, StartDate, GmtOffset, Meeting } = this.sessionInfo;

		if (
			Key === undefined ||
			Type === undefined ||
			Name === undefined ||
			StartDate === undefined ||
			GmtOffset === undefined ||
			Meeting === undefined
		) {
			return [];
		}

		const session: Omit<Session, 'totalLaps'> = {
			id: String(Key),
			name: Name,
			meetingName: Meeting.Name,
			circuit: Meeting.Circuit.ShortName,
			countryCode: Meeting.Country.Code,
			type: sessionTypeOf(Type, Name),
			startsAt: utcStart(StartDate, GmtOffset)
		};

		const sent = JSON.stringify(session);

		if (sent === this.sessionSent) {
			return [];
		}

		this.sessionSent = sent;

		return [{ kind: 'session_info', at, session }];
	}

	private onSessionStatus(update: z.output<typeof sessionStatusSchema>, at: string): RaceEvent[] {
		const status = SESSION_STATUS_BY_FEED.get(update.Status ?? '');

		if (status === undefined || status === this.sessionStatus) {
			return [];
		}

		this.sessionStatus = status;
		this.started ||= status === 'started';

		return [{ kind: 'session_status', at, status }];
	}

	private onDriverList(update: z.output<typeof driverListSchema>, at: string): RaceEvent[] {
		return update.flatMap(([number, fields]): RaceEvent[] => {
			const merged = { ...this.drivers.get(number), ...fields };

			this.drivers.set(number, merged);

			const { Tla } = merged;
			const names = driverNames(merged);

			if (Tla === undefined || names === null) {
				return [];
			}

			const driver: Driver = {
				number,
				code: Tla,
				firstName: names.firstName,
				lastName: names.lastName,
				team: merged.TeamName ?? UNKNOWN_TEAM,
				teamColour: merged.TeamColour ?? UNKNOWN_TEAM_COLOUR
			};

			if (merged.HeadshotUrl) {
				driver.headshotUrl = merged.HeadshotUrl;
			}

			if (merged.PublicIdRight) {
				driver.imageId = merged.PublicIdRight;
			}

			const sent = JSON.stringify(driver);

			if (sent === this.driversSent.get(number)) {
				return [];
			}

			this.driversSent.set(number, sent);

			return [{ kind: 'driver_entry', at, driver }];
		});
	}

	private onLapCount(update: z.output<typeof lapCountSchema>, at: string): RaceEvent[] {
		if (update.TotalLaps === undefined || update.TotalLaps === this.totalLaps) {
			return [];
		}

		this.totalLaps = update.TotalLaps;

		return [{ kind: 'race_distance', at, totalLaps: update.TotalLaps }];
	}

	private onTrackStatus(update: z.output<typeof trackStatusSchema>, at: string): RaceEvent[] {
		const status = TRACK_STATUS_BY_CODE.get(update.Status ?? '');

		if (status === undefined || status === this.trackStatus) {
			return [];
		}

		this.trackStatus = status;

		return [{ kind: 'track_status', at, status }];
	}

	private onTimingData(
		update: z.output<typeof timingDataSchema>,
		at: string,
		timestamp: number
	): RaceEvent[] {
		return (update.Lines ?? []).flatMap(([driverNumber, delta]) => {
			const line = this.lineOf(driverNumber);
			const events: RaceEvent[] = [];

			// Practice publishes its gaps to the fastest lap under other names.
			const gapToLeader = delta.GapToLeader ?? delta.TimeDiffToFastest;
			const interval = delta.IntervalToPositionAhead?.Value ?? delta.TimeDiffToPositionAhead;

			line.position = delta.Position ?? line.position;
			line.gapToLeader = gapToLeader ?? line.gapToLeader;
			line.interval = interval ?? line.interval;

			for (const [index, sector] of delta.Sectors ?? []) {
				if (sector.Value !== undefined && index >= 0 && index < 3) {
					line.sectors[index] = sector.Value;
				}
			}

			// A keyframe after a reconnect repeats the last lap time; only a new one is pending.
			const lastLapTime = delta.LastLapTime?.Value;

			if (lastLapTime && lastLapTime !== line.lastLapTime) {
				line.pendingLapTime = lastLapTime;
			}

			line.lastLapTime = lastLapTime ?? line.lastLapTime;

			const position = parseNumber(line.position);

			if (
				position !== null &&
				(delta.Position !== undefined || gapToLeader !== undefined || interval !== undefined)
			) {
				events.push({
					kind: 'standing',
					at,
					driverNumber,
					position,
					gapToLeaderMs: parseGap(line.gapToLeader, position),
					intervalMs: parseGap(line.interval, position)
				});
			}

			if (delta.InPit !== undefined && delta.InPit !== line.inPit) {
				line.inPit = delta.InPit;
				events.push(...this.onPitLane(driverNumber, line, at, timestamp));
			}

			if (delta.NumberOfLaps !== undefined && delta.NumberOfLaps > line.lapsCompleted) {
				const [first, second, third] = line.sectors.map(parseDuration);

				line.lapsCompleted = delta.NumberOfLaps;
				events.push({
					kind: 'lap_completed',
					at,
					driverNumber,
					lap: delta.NumberOfLaps,
					lapTimeMs: line.pendingLapTime === null ? null : parseDuration(line.pendingLapTime),
					sectorTimesMs: [first ?? null, second ?? null, third ?? null]
				});
				line.pendingLapTime = null;
			}

			if (delta.Retired) {
				events.push(...this.retire(driverNumber, at));
			}

			return events;
		});
	}

	/** Pit lane visits count from the start, so leaving the garage or a pit-lane start is not a stop. */
	private onPitLane(
		driverNumber: string,
		line: TimingLine,
		at: string,
		timestamp: number
	): RaceEvent[] {
		if (!this.started) {
			return [];
		}

		if (line.inPit) {
			const lap = line.lapsCompleted + 1;

			line.pitEntry = { lap, timestamp };
			line.lastPitEntryLap = lap;

			return [{ kind: 'pit_entry', at, driverNumber, lap }];
		}

		const entry = line.pitEntry;

		line.pitEntry = null;

		return entry
			? [
					{
						kind: 'pit_exit',
						at,
						driverNumber,
						lap: entry.lap,
						laneTimeMs: timestamp - entry.timestamp
					}
				]
			: [];
	}

	private lineOf(driverNumber: string): TimingLine {
		const existing = this.lines.get(driverNumber);

		if (existing) {
			return existing;
		}

		const line: TimingLine = {
			position: '',
			gapToLeader: '',
			interval: '',
			lapsCompleted: 0,
			inPit: false,
			sectors: ['', '', ''],
			lastLapTime: '',
			pendingLapTime: null,
			pitEntry: null,
			lastPitEntryLap: null
		};

		this.lines.set(driverNumber, line);

		return line;
	}

	private retire(driverNumber: string, at: string): RaceEvent[] {
		if (this.retired.has(driverNumber)) {
			return [];
		}

		this.retired.add(driverNumber);

		return [{ kind: 'retirement', at, driverNumber, reason: 'Retired' }];
	}

	private onTimingAppData(update: z.output<typeof timingAppDataSchema>, at: string): RaceEvent[] {
		return (update.Lines ?? []).flatMap(([driverNumber, delta]): RaceEvent[] => {
			const events = this.onStints(driverNumber, delta.Stints ?? [], at);
			const position = parseNumber(delta.GridPos);

			if (position !== null && position > 0 && this.grid.get(driverNumber) !== position) {
				this.grid.set(driverNumber, position);
				events.unshift({ kind: 'grid_position', at, driverNumber, position });
			}

			return events;
		});
	}

	/**
	 * TimingAppData and TyreStintSeries number stints the same way and are merged into one
	 * table. A new stint starts on the lap after the last pit entry, or after the lap in
	 * progress when the stint appears without one.
	 */
	private onStints(
		driverNumber: string,
		updates: readonly (readonly [number, StintUpdate])[],
		at: string
	): RaceEvent[] {
		const stints = this.stints.get(driverNumber) ?? new Map<number, StintEntry>();

		this.stints.set(driverNumber, stints);

		return updates.flatMap(([index, update]): RaceEvent[] => {
			const stint = stints.get(index) ?? {
				compound: undefined,
				tyreAgeAtStart: 0,
				tyreAge: 0,
				startLap: this.nextStintStart(driverNumber, stints, index),
				sent: ''
			};

			stint.compound = update.Compound ?? stint.compound;
			stint.tyreAgeAtStart = update.StartLaps ?? stint.tyreAgeAtStart;
			stint.tyreAge = update.TotalLaps ?? stint.tyreAge;
			stints.set(index, stint);

			if (stint.compound === undefined) {
				return [];
			}

			const event: TyresFittedEvent = {
				kind: 'tyres_fitted',
				at,
				driverNumber,
				startLap: stint.startLap,
				compound: compoundOf(stint.compound),
				tyreAgeAtStart: stint.tyreAgeAtStart
			};

			const sent = `${event.compound}/${event.tyreAgeAtStart}`;

			if (sent === stint.sent) {
				return [];
			}

			stint.sent = sent;

			return [event];
		});
	}

	private nextStintStart(
		driverNumber: string,
		stints: ReadonlyMap<number, StintEntry>,
		index: number
	): number {
		if (index === 0) {
			return 1;
		}

		const line = this.lineOf(driverNumber);
		const latestStart = Math.max(1, ...[...stints.values()].map((stint) => stint.startLap));

		if (line.lastPitEntryLap !== null && line.lastPitEntryLap + 1 > latestStart) {
			return line.lastPitEntryLap + 1;
		}

		// Without a pit entry, as when joining mid-session, the stint before ran its own laps.
		const previous = stints.get(index - 1);

		return previous
			? previous.startLap + Math.max(0, previous.tyreAge - previous.tyreAgeAtStart)
			: line.lapsCompleted + 1;
	}

	private onTimingStats(update: z.output<typeof timingStatsSchema>, at: string): RaceEvent[] {
		return (update.Lines ?? []).flatMap(([driverNumber, delta]): RaceEvent[] => {
			const entry = this.bests.get(driverNumber) ?? {
				lapTime: '',
				lap: null,
				sectors: ['', '', ''],
				speeds: { I1: '', I2: '', FL: '', ST: '' },
				sent: ''
			};

			this.bests.set(driverNumber, entry);
			entry.lapTime = delta.PersonalBestLapTime?.Value ?? entry.lapTime;
			entry.lap = delta.PersonalBestLapTime?.Lap ?? entry.lap;

			for (const [index, sector] of delta.BestSectors ?? []) {
				if (sector.Value !== undefined && index >= 0 && index < 3) {
					entry.sectors[index] = sector.Value;
				}
			}

			const speeds = delta.BestSpeeds ?? {};

			entry.speeds = {
				I1: speeds.I1?.Value ?? entry.speeds.I1,
				I2: speeds.I2?.Value ?? entry.speeds.I2,
				FL: speeds.FL?.Value ?? entry.speeds.FL,
				ST: speeds.ST?.Value ?? entry.speeds.ST
			};

			const [first, second, third] = entry.sectors.map(parseDuration);
			const lapTimeMs = parseDuration(entry.lapTime);

			const best: PersonalBest = {
				driverNumber,
				lapTimeMs,
				lap: lapTimeMs === null ? null : entry.lap,
				sectorTimesMs: [first ?? null, second ?? null, third ?? null],
				topSpeedsKph: {
					intermediate1: parseNumber(entry.speeds.I1),
					intermediate2: parseNumber(entry.speeds.I2),
					finishLine: parseNumber(entry.speeds.FL),
					speedTrap: parseNumber(entry.speeds.ST)
				}
			};

			const sent = JSON.stringify(best);

			if (sent === entry.sent) {
				return [];
			}

			entry.sent = sent;

			return [{ kind: 'personal_best', at, best }];
		});
	}

	/** Lane times to a tenth; PitStopSeries, where it exists, has them to the millisecond. */
	private onPitLaneTimes(
		update: z.output<typeof pitLaneTimeCollectionSchema>,
		at: string
	): RaceEvent[] {
		return (update.PitTimes ?? []).flatMap(([driverNumber, time]): RaceEvent[] => {
			const lap = parseNumber(time.Lap);
			const laneTimeMs = parseDuration(time.Duration ?? '');

			if (
				lap === null ||
				laneTimeMs === null ||
				this.stopsWithSeries.has(`${driverNumber}/${lap}`)
			) {
				return [];
			}

			return this.publishStop(at, { driverNumber, lap, laneTimeMs });
		});
	}

	private onPitStopSeries(update: z.output<typeof pitStopSeriesSchema>, at: string): RaceEvent[] {
		return (update.PitTimes ?? []).flatMap(([driverNumber, stops]) =>
			stops.flatMap(([, { PitStop: stop }]): RaceEvent[] => {
				const lap = parseNumber(stop?.Lap);
				const laneTimeMs = parseDuration(stop?.PitLaneTime ?? '');
				const stationaryMs = parseDuration(stop?.PitStopTime ?? '');

				if (lap === null || laneTimeMs === null) {
					return [];
				}

				this.stopsWithSeries.add(`${driverNumber}/${lap}`);

				return this.publishStop(
					at,
					stationaryMs === null
						? { driverNumber, lap, laneTimeMs }
						: { driverNumber, lap, laneTimeMs, stationaryMs }
				);
			})
		);
	}

	private publishStop(
		at: string,
		stop: { driverNumber: string; lap: number; laneTimeMs: number; stationaryMs?: number }
	): RaceEvent[] {
		const sent = JSON.stringify(stop);

		if (this.publishedStops.has(sent)) {
			return [];
		}

		this.publishedStops.add(sent);

		return [{ kind: 'pit_lane_time', at, stop }];
	}

	private onRaceControl(
		update: z.output<typeof raceControlMessagesSchema>,
		at: string
	): RaceEvent[] {
		return (update.Messages ?? []).flatMap(([index, message]): RaceEvent[] => {
			if (this.raceControlSeen.has(index) || message.Message === undefined) {
				return [];
			}

			this.raceControlSeen.add(index);

			const text = message.Message;
			const lap = message.Lap ?? 1;
			const driverNumber = message.RacingNumber ?? RACE_CONTROL_CAR.exec(text)?.[1];
			const category = raceControlCategory(message.Category ?? '', text);

			const events: RaceEvent[] = [
				{
					kind: 'race_control',
					at,
					message:
						driverNumber === undefined
							? { lap, category, message: text }
							: { lap, category, message: text, driverNumber }
				}
			];

			const penalty = category === 'penalty' ? parsePenalty(text, lap) : null;

			if (penalty) {
				events.push({ kind: 'penalty', at, penalty });
			}

			return events;
		});
	}

	private onWeather(update: WeatherFields, at: string): RaceEvent[] {
		this.weather = { ...this.weather, ...update };

		const airTempC = parseNumber(this.weather.AirTemp);
		const trackTempC = parseNumber(this.weather.TrackTemp);
		const humidityPct = parseNumber(this.weather.Humidity);
		const windSpeedMs = parseNumber(this.weather.WindSpeed);
		const rainfall = parseNumber(this.weather.Rainfall);

		if (
			airTempC === null ||
			trackTempC === null ||
			humidityPct === null ||
			windSpeedMs === null ||
			rainfall === null
		) {
			return [];
		}

		return [
			{
				kind: 'weather',
				at,
				sample: { airTempC, trackTempC, humidityPct, windSpeedMs, rainfall: rainfall > 0 }
			}
		];
	}
}

function parse<T extends z.ZodType>(schema: T, frame: TopicFrame): z.output<T> {
	const result = schema.safeParse(frame.data);

	if (!result.success) {
		const at = new Date(frame.timestamp).toISOString();

		throw new Error(`${frame.topic} frame at ${at}: ${z.prettifyError(result.error)}`);
	}

	return result.data;
}
