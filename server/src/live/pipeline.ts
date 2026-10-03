import path from 'node:path';

import { z } from 'zod';

import { F1Decoder, F1_TOPICS } from '../sources/f1/decode.js';
import type { TopicFrame } from '../sources/f1/decode.js';
import { FEED_TOPICS, LiveFeed, describeError } from '../sources/f1/live.js';
import type { EventLog, FeedFrame, FeedSnapshot, LiveFeedOptions } from '../sources/f1/live.js';
import { RawWriter } from '../sources/f1/raw-writer.js';
import type { Recording } from './importer.js';
import type { LiveSession } from './session.js';

const END_STATUSES = new Set(['finished', 'finalised', 'ended']);

const DECODE_LOG_EVERY = 1000;

const sessionKeySchema = z.object({ Key: z.number() });

/** What the recorder logs when it opens a session's files. */
const recordedSessionSchema = z.object({ key: z.number(), path: z.string() });

export type FeedOptions = Omit<LiveFeedOptions, 'topics' | 'log'>;

export interface PipelineOptions {
	session: LiveSession;
	/** Where the recorder writes `<archive path>/<Topic>.jsonStream`. */
	rawDir: string;
	feed: FeedOptions;
	log: EventLog;
	/** The clock for the recorder and for snapshot frames; a replay runs it on session time. */
	now?: () => number;
	onSessionEnded?: (recording: Recording) => void;
}

/**
 * The live path: the hub's frames are recorded in archive format, decoded to race events and
 * applied to the live session. The decoder is the archive's, so a live session and its later
 * import read the same data the same way.
 */
export class LivePipeline {
	private readonly options: PipelineOptions;
	private readonly now: () => number;
	private readonly writer: RawWriter;
	private readonly feed: LiveFeed;
	private decoder = new F1Decoder();
	private sessionKey: number | null = null;
	private recording: Recording | null = null;
	private decodeFailures = 0;

	constructor(options: PipelineOptions) {
		const { rawDir, log, feed, now = Date.now } = options;

		this.options = options;
		this.now = now;
		this.writer = new RawWriter(
			rawDir,
			(event, fields) => {
				const opened = event === 'session' ? recordedSessionSchema.safeParse(fields) : null;

				if (opened?.success) {
					this.recording = { key: opened.data.key, dir: path.resolve(rawDir, opened.data.path) };
				}

				log(event, fields);
			},
			now
		);
		this.feed = new LiveFeed(
			{ ...feed, topics: FEED_TOPICS, log },
			{
				onSnapshot: (snapshot) => this.onSnapshot(snapshot),
				onFrame: (frame) => this.onFrame(frame)
			}
		);
	}

	/** Runs until `signal` aborts; the feed reconnects on its own. */
	async run(signal: AbortSignal): Promise<void> {
		try {
			await this.feed.run(signal);
		} finally {
			this.writer.close();
		}
	}

	private onSnapshot(snapshot: FeedSnapshot) {
		this.writer.writeSnapshot(snapshot);

		const at = this.now();

		for (const topic of F1_TOPICS) {
			const data = snapshot[topic];

			if (data !== undefined) {
				this.decode({ topic, data, timestamp: at });
			}
		}
	}

	private onFrame(frame: FeedFrame) {
		this.writer.writeFrame(frame);

		const sent = frame.timestamp === null ? Number.NaN : Date.parse(frame.timestamp);

		this.decode({
			topic: frame.topic,
			data: frame.payload,
			timestamp: Number.isNaN(sent) ? this.now() : sent
		});
	}

	private decode(frame: TopicFrame) {
		if (frame.topic === 'SessionInfo') {
			this.followSession(frame);
		}

		let events;

		try {
			events = this.decoder.decode(frame);
		} catch (cause) {
			this.decodeFailures += 1;

			if (this.decodeFailures === 1 || this.decodeFailures % DECODE_LOG_EVERY === 0) {
				this.options.log('decode-failed', {
					topic: frame.topic,
					failures: this.decodeFailures,
					error: describeError(cause)
				});
			}

			return;
		}

		this.options.session.push(events);

		if (
			this.recording &&
			events.some((event) => event.kind === 'session_status' && END_STATUSES.has(event.status))
		) {
			this.options.onSessionEnded?.(this.recording);
		}
	}

	/** The decoder holds one session's merged state, so the next session gets a new one. */
	private followSession(frame: TopicFrame) {
		const key = sessionKeySchema.safeParse(frame.data);

		if (key.success && key.data.Key !== this.sessionKey) {
			if (this.sessionKey !== null) {
				this.decoder = new F1Decoder();
			}

			this.sessionKey = key.data.Key;
		}
	}
}
