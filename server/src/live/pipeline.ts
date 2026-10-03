import path from 'node:path';

import { z } from 'zod';

import { F1Decoder, F1_TOPICS } from '../sources/f1/decode.js';
import type { TopicFrame } from '../sources/f1/decode.js';
import { FEED_TOPICS, LiveFeed, describeError } from '../sources/f1/live.js';
import type {
	EventLog,
	FeedFrame,
	FeedSnapshot,
	JsonValue,
	LiveFeedOptions
} from '../sources/f1/live.js';
import { readArchive } from '../sources/f1/archive.js';
import { RawWriter } from '../sources/f1/raw-writer.js';
import type { Recording } from './importer.js';
import type { LiveSession } from './session.js';

const END_STATUSES = new Set(['finished', 'finalised', 'ended']);

const FAILURE_LOG_EVERY = 1000;

const sessionKeySchema = z.object({ Key: z.number() });

/** What the recorder logs when it opens a session's files. */
const recordedSessionSchema = z.object({
	key: z.number(),
	path: z.string(),
	resumed: z.boolean().optional()
});

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
	/** Every frame as it arrives, for the opt-in position channels; they pick the topics they read. */
	onTelemetry?: (topic: string, payload: JsonValue) => void;
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
	/** A recording of this session from before a restart, to rebuild the state from. */
	private resumeDir: string | null = null;
	private restoring: Promise<void> | null = null;
	/** What the feed sent while the state was being rebuilt, in order. */
	private waiting: (() => void)[] = [];
	private failures = 0;

	constructor(options: PipelineOptions) {
		const { rawDir, log, feed, now = Date.now } = options;

		this.options = options;
		this.now = now;
		this.writer = new RawWriter(
			rawDir,
			(event, fields) => {
				const opened = event === 'session' ? recordedSessionSchema.safeParse(fields) : null;

				if (opened?.success) {
					this.recording = {
						key: opened.data.key,
						dir: path.resolve(rawDir, opened.data.path),
						root: path.resolve(rawDir)
					};
					this.resumeDir = opened.data.resumed === true ? this.recording.dir : null;
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
		if (this.restoring) {
			this.waiting.push(() => this.onSnapshot(snapshot));

			return;
		}

		this.writer.writeSnapshot(snapshot);

		if (this.resumeDir !== null) {
			this.restore(this.resumeDir);

			return;
		}

		const at = this.now();

		for (const topic of F1_TOPICS) {
			const data = snapshot[topic];

			if (data !== undefined) {
				this.decode({ topic, data, timestamp: at }, false);
			}
		}
	}

	/**
	 * After a restart the recording holds everything the session did before it: read it back
	 * through the decoder, so the state is whole, then go on with what the feed sent meanwhile.
	 * The recording already holds the subscribe result that started this.
	 */
	private restore(dir: string) {
		this.resumeDir = null;
		this.restoring = this.replayRecording(dir);
	}

	private async replayRecording(dir: string): Promise<void> {
		try {
			for (const frame of await readArchive(dir)) {
				this.decode(frame, false);
			}
		} catch (cause) {
			this.options.log('restore-failed', { error: describeError(cause) });
		}

		this.restoring = null;

		const waiting = this.waiting;

		this.waiting = [];

		for (const resume of waiting) {
			resume();
		}
	}

	private onFrame(frame: FeedFrame) {
		if (this.restoring) {
			this.waiting.push(() => this.onFrame(frame));

			return;
		}

		this.writer.writeFrame(frame);
		this.options.onTelemetry?.(frame.topic, frame.payload);

		const sent = frame.timestamp === null ? Number.NaN : Date.parse(frame.timestamp);

		this.decode(
			{
				topic: frame.topic,
				data: frame.payload,
				timestamp: Number.isNaN(sent) ? this.now() : sent
			},
			true
		);
	}

	/**
	 * `announced` frames report a change as it happens. A subscribe result only restates how
	 * things stand, so a server that starts after a session ended does not import it again.
	 */
	private decode(frame: TopicFrame, announced: boolean) {
		if (frame.topic === 'SessionInfo') {
			this.followSession(frame);
		}

		let events;

		try {
			events = this.decoder.decode(frame);
			this.options.session.push(events);
		} catch (cause) {
			this.failures += 1;

			if (this.failures === 1 || this.failures % FAILURE_LOG_EVERY === 0) {
				this.options.log('frame-failed', {
					topic: frame.topic,
					failures: this.failures,
					error: describeError(cause)
				});
			}

			return;
		}

		if (
			announced &&
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
