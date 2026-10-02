import { setTimeout as delay } from 'node:timers/promises';

import { WebSocket } from 'ws';
import { z } from 'zod';

export const LIVE_TIMING_URL = 'https://livetiming.formula1.com/signalrcore';

/** The Feeds list of the archive's Index.json for a race, the widest session type. */
export const FEED_TOPICS = [
	'SessionInfo',
	'ArchiveStatus',
	'TrackStatus',
	'SessionData',
	'ContentStreams',
	'ChampionshipPrediction',
	'AudioStreams',
	'ExtrapolatedClock',
	'TyreStintSeries',
	'CarData.z',
	'Position.z',
	'LapCount',
	'DriverList',
	'TimingStats',
	'DriverRaceInfo',
	'TimingDataF1',
	'DriverTracker',
	'TimingData',
	'WeatherData',
	'WeatherDataSeries',
	'TimingAppData',
	'SessionStatus',
	'LapSeries',
	'TopThree',
	'Heartbeat',
	'TlaRcm',
	'RaceControlMessages',
	'TeamRadio',
	'CurrentTyres',
	'OvertakeSeries',
	'PitLaneTimeCollection',
	'PitStop',
	'PitStopSeries'
] as const;

/** SignalR record separator between JSON messages. */
const RECORD_SEPARATOR = '\x1e';

const SUBSCRIBE_INVOCATION_ID = '1';

const NEGOTIATE_TIMEOUT_MS = 15_000;

const ORIGIN = 'https://www.formula1.com';

const MessageType = {
	INVOCATION: 1,
	COMPLETION: 3,
	PING: 6,
	CLOSE: 7
} as const;

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export type JsonObject = { [key: string]: JsonValue };

/** Every topic's current state, as the hub returns it when a subscription completes. */
export type FeedSnapshot = JsonObject;

/** One `feed` invocation: a topic's change and the hub's UTC timestamp for it. */
export type FeedFrame = { topic: string; payload: JsonValue; timestamp: string | null };

export type FeedHandlers = {
	onSnapshot: (snapshot: FeedSnapshot) => void;
	onFrame: (frame: FeedFrame) => void;
};

type LogValue = string | number | boolean | null | string[] | { [key: string]: number };

export type EventLog = (event: string, fields?: { [field: string]: LogValue }) => void;

export type Backoff = { initialMs: number; maxMs: number };

export type LiveFeedOptions = {
	/** The hub's https URL; negotiate is under it and the socket uses its ws twin. */
	url: string;
	topics: readonly string[];
	/** No message at all (pings included) for this long means the connection is dead. */
	stallMs: number;
	backoff: Backoff;
	statsIntervalMs: number;
	log: EventLog;
	/**
	 * An F1 TV subscription token. Without one the hub withholds gated topics (car data,
	 * positions, championship tables, pit stop times); everything else still records.
	 */
	accessToken?: string;
	random?: () => number;
};

/** The hub's messages are an undocumented contract, checked only as far as the recorder reads. */
const hubMessageSchema = z.object({
	type: z.number().optional(),
	target: z.string().optional(),
	invocationId: z.string().optional(),
	arguments: z.array(z.json()).optional(),
	result: z.record(z.string(), z.json()).nullish(),
	error: z.string().nullish(),
	allowReconnect: z.boolean().optional()
});

const topicSchema = z.string();

/** A zone-less timestamp would parse as local time, so only UTC ones are trusted. */
const sentAtSchema = z.iso.datetime();

type HubMessage = z.infer<typeof hubMessageSchema>;

type Negotiated = { connectionToken: string; cookie: string | null };

/** `healthy`: the subscription held for a whole watchdog period. */
type ConnectionEnd = { healthy: boolean; reason: string };

/**
 * Keeps one subscription to the live timing hub open until stopped: it reconnects with
 * backoff when the socket drops, the hub closes it or the watchdog sees a stalled feed.
 */
export class LiveFeed {
	private readonly options: LiveFeedOptions;
	private readonly handlers: FeedHandlers;
	private readonly frameCounts = new Map<string, number>();
	/** Topics that had state in a snapshot or sent a frame, to show which ones stay dark. */
	private readonly topicsWithData = new Set<string>();
	private totalFrames = 0;

	constructor(options: LiveFeedOptions, handlers: FeedHandlers) {
		this.options = options;
		this.handlers = handlers;
	}

	async run(signal: AbortSignal): Promise<void> {
		const stats = setInterval(() => this.logFrameCounts(), this.options.statsIntervalMs);
		let failures = 0;

		try {
			while (!signal.aborted) {
				// oxlint-disable-next-line no-await-in-loop -- one connection at a time, by design.
				failures = await this.connectThenBackOff(failures, signal);
			}
		} finally {
			clearInterval(stats);
			this.logFrameCounts();
		}
	}

	/** Runs one connection to its end and waits out the backoff; returns the failure streak. */
	private async connectThenBackOff(failures: number, signal: AbortSignal): Promise<number> {
		const { backoff, log, random = Math.random } = this.options;
		const end = await this.connectOnce(signal);

		if (signal.aborted) {
			return failures;
		}

		// A hub that drops every connection right after Subscribe still backs off.
		const streak = end.healthy ? 0 : failures;
		const delayMs = backoffDelay(streak, backoff, random);

		log('reconnect', { reason: end.reason, attempt: streak + 1, delayMs });
		await delay(delayMs, undefined, { signal }).catch(() => undefined);

		return streak + 1;
	}

	private async connectOnce(signal: AbortSignal): Promise<ConnectionEnd> {
		const { url, accessToken, log } = this.options;
		let negotiated: Negotiated;

		try {
			negotiated = await negotiate(url, accessToken, signal);
		} catch (cause) {
			log('negotiate-failed', { error: describe(cause) });

			return { healthy: false, reason: 'negotiate-failed' };
		}

		// An abort during negotiate has already fired and would never reach the socket.
		if (signal.aborted) {
			return { healthy: false, reason: 'stopped' };
		}

		log('negotiated', { url });

		return this.listen(negotiated, signal);
	}

	private listen(negotiated: Negotiated, signal: AbortSignal): Promise<ConnectionEnd> {
		const { url, topics, stallMs, accessToken, log } = this.options;

		return new Promise((resolve) => {
			const query = new URLSearchParams({
				id: negotiated.connectionToken,
				...(accessToken && { access_token: accessToken })
			});

			const socket = new WebSocket(`${url.replace(/^http/, 'ws')}?${query.toString()}`, {
				headers: hubHeaders(negotiated.cookie, accessToken)
			});

			// The hub sends feed frames as soon as the subscription exists, which can be before
			// the subscribe result; they are held so a snapshot always comes first.
			const early: FeedFrame[] = [];
			let handshaken = false;
			let subscribed = false;
			let subscribedAt = 0;
			let reason = 'closed';

			const end = (why: string) => {
				reason = why;
				socket.terminate();
			};

			// Until the subscription completes the clock runs from the socket's creation, so a
			// hung handshake or subscribe counts as a stall too.
			const watchdog = setTimeout(() => {
				log('stall', { silentMs: stallMs, subscribed });
				end('stall');
			}, stallMs);

			const onAbort = () => end('stopped');

			signal.addEventListener('abort', onAbort, { once: true });

			socket.on('open', () => {
				log('connected', {});
				socket.send(encode({ protocol: 'json', version: 1 }));
			});

			socket.on('message', (data) => {
				if (subscribed) {
					watchdog.refresh();
				}

				for (const text of data.toString().split(RECORD_SEPARATOR)) {
					if (text === '') {
						continue;
					}

					const message = parseHubMessage(text);

					if (!message) {
						log('bad-message', { text });
						continue;
					}

					if (!handshaken) {
						if (message.error) {
							log('handshake-failed', { error: message.error });
							end('handshake-failed');

							return;
						}

						handshaken = true;
						socket.send(
							encode({
								type: MessageType.INVOCATION,
								invocationId: SUBSCRIBE_INVOCATION_ID,
								target: 'Subscribe',
								arguments: [[...topics]]
							})
						);
						continue;
					}

					switch (message.type) {
						case MessageType.PING:
							socket.send(encode({ type: MessageType.PING }));
							break;
						case MessageType.CLOSE:
							log('hub-closed', {
								error: message.error ?? null,
								allowReconnect: message.allowReconnect ?? null
							});
							end('hub-closed');

							return;
						case MessageType.COMPLETION: {
							if (message.invocationId !== SUBSCRIBE_INVOCATION_ID) {
								break;
							}

							if (message.error || !message.result) {
								log('subscribe-failed', { error: message.error ?? 'no result' });
								end('subscribe-failed');

								return;
							}

							const snapshot = message.result;

							subscribed = true;
							subscribedAt = Date.now();
							watchdog.refresh();
							log('subscribed', {
								requested: topics.length,
								inSnapshot: Object.keys(snapshot).length,
								missing: topics.filter((topic) => !(topic in snapshot))
							});

							for (const topic of Object.keys(snapshot)) {
								this.topicsWithData.add(topic);
							}

							this.handlers.onSnapshot(snapshot);

							for (const frame of early.splice(0)) {
								this.deliver(frame);
							}

							break;
						}

						case MessageType.INVOCATION: {
							const frame = message.target === 'feed' ? toFeedFrame(message.arguments) : null;

							if (!frame) {
								break;
							}

							if (subscribed) {
								this.deliver(frame);
							} else {
								early.push(frame);
							}

							break;
						}
					}
				}
			});

			socket.on('error', (error) => {
				log('socket-error', { error: error.message });
			});

			socket.on('close', (code, closeReason) => {
				clearTimeout(watchdog);
				signal.removeEventListener('abort', onAbort);
				log('disconnected', { code, closeReason: closeReason.toString(), reason, subscribed });
				resolve({ healthy: subscribed && Date.now() - subscribedAt >= stallMs, reason });
			});
		});
	}

	private deliver(frame: FeedFrame) {
		this.totalFrames += 1;
		this.frameCounts.set(frame.topic, (this.frameCounts.get(frame.topic) ?? 0) + 1);
		this.topicsWithData.add(frame.topic);
		this.handlers.onFrame(frame);
	}

	private logFrameCounts() {
		this.options.log('frames', {
			total: this.totalFrames,
			sinceLast: Object.fromEntries(this.frameCounts),
			noData: this.options.topics.filter((topic) => !this.topicsWithData.has(topic))
		});
		this.frameCounts.clear();
	}
}

/** Exponential backoff with equal jitter: half the capped delay is fixed, half is random. */
export function backoffDelay(attempt: number, backoff: Backoff, random: () => number): number {
	const capped = Math.min(backoff.maxMs, backoff.initialMs * 2 ** attempt);

	return Math.round(capped / 2 + (random() * capped) / 2);
}

async function negotiate(
	url: string,
	accessToken: string | undefined,
	signal: AbortSignal
): Promise<Negotiated> {
	const timeout = AbortSignal.any([signal, AbortSignal.timeout(NEGOTIATE_TIMEOUT_MS)]);

	// The load balancer pins the socket to the negotiating node through this cookie.
	const preflight = await fetch(`${url}/negotiate`, {
		method: 'OPTIONS',
		headers: {
			Accept: '*/*',
			'Access-Control-Request-Method': 'POST',
			'Access-Control-Request-Headers': 'content-type,x-requested-with',
			Origin: ORIGIN,
			Referer: `${ORIGIN}/`
		},
		signal: timeout
	});

	const preflightCookie = balancerCookie(preflight.headers);

	const response = await fetch(`${url}/negotiate?negotiateVersion=1`, {
		method: 'POST',
		headers: {
			...hubHeaders(preflightCookie, accessToken),
			'Content-Type': 'application/json',
			'X-Requested-With': 'XMLHttpRequest',
			Referer: `${ORIGIN}/`
		},
		body: '{}',
		signal: timeout
	});

	if (!response.ok) {
		throw new Error(`negotiate returned ${response.status.toString()}`);
	}

	// SAFETY: a successful negotiate response is the SignalR negotiate payload.
	const body = (await response.json()) as { connectionToken?: string; connectionId?: string };
	const connectionToken = body.connectionToken ?? body.connectionId;

	if (!connectionToken) {
		throw new Error('negotiate returned no connection token');
	}

	return { connectionToken, cookie: balancerCookie(response.headers) ?? preflightCookie };
}

function balancerCookie(headers: Headers): string | null {
	return /AWSALBCORS=([^;]+)/.exec(headers.get('set-cookie') ?? '')?.[1] ?? null;
}

function hubHeaders(cookie: string | null, accessToken: string | undefined) {
	return {
		Origin: ORIGIN,
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		...(cookie && { Cookie: `AWSALBCORS=${cookie}` }),
		...(accessToken && { Authorization: `Bearer ${accessToken}` })
	};
}

function encode(message: JsonObject): string {
	return `${JSON.stringify(message)}${RECORD_SEPARATOR}`;
}

function parseHubMessage(text: string): HubMessage | null {
	let value: unknown;

	try {
		value = JSON.parse(text);
	} catch {
		return null;
	}

	const parsed = hubMessageSchema.safeParse(value);

	return parsed.success ? parsed.data : null;
}

/** `feed` arguments: topic, payload and, when the hub sends one, its UTC timestamp. */
function toFeedFrame(args: JsonValue[] | undefined): FeedFrame | null {
	const [topic, payload, timestamp] = args ?? [];
	const parsedTopic = topicSchema.safeParse(topic);

	if (!parsedTopic.success || payload === undefined) {
		return null;
	}

	const sentAt = sentAtSchema.safeParse(timestamp);

	return { topic: parsedTopic.data, payload, timestamp: sentAt.success ? sentAt.data : null };
}

function describe(cause: unknown): string {
	if (!(cause instanceof Error)) {
		return String(cause);
	}

	// fetch reports network failures as "fetch failed" with the reason in `cause`.
	return cause.cause instanceof Error ? `${cause.message}: ${cause.cause.message}` : cause.message;
}
