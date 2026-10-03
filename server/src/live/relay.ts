import { setTimeout as delay } from 'node:timers/promises';

import type { RaceEvent } from '@f1-live/shared';
import { z } from 'zod';

import { backoffDelay, describeError } from '../sources/f1/live.js';
import type { Backoff, EventLog } from '../sources/f1/live.js';
import type { Position, LiveSession } from './session.js';

/** Events per request, so a long outage is caught up in bounded pieces. */
const MAX_EVENTS_PER_PUSH = 5000;

const PUSH_TIMEOUT_MS = 30_000;

/** What the relay answers to a push: where its copy of the session stands now. */
export const positionSchema = z.object({ epoch: z.string(), seq: z.number().int().min(0) });

export interface RelayPusherOptions {
	/** The relay's base URL; pushes go to `/ingest/events` and `/ingest/state` under it. */
	url: string;
	secret: string;
	backoff: Backoff;
	log: EventLog;
	fetchImpl?: typeof fetch;
	random?: () => number;
}

/**
 * Ingest side of the split: keeps a relay's copy of the live session up to date over HTTP. The
 * session's own event log is the buffer. After an outage the pusher resends what the relay is
 * missing from where the relay says it stands, or the whole state when the log no longer reaches
 * back that far or the relay started over.
 */
export class RelayPusher {
	private readonly session: LiveSession;
	private readonly options: RelayPusherOptions;
	private readonly fetchImpl: typeof fetch;
	private known: Position | null = null;
	private wake: (() => void) | null = null;
	private dirty = true;

	constructor(session: LiveSession, options: RelayPusherOptions) {
		this.session = session;
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async run(signal: AbortSignal): Promise<void> {
		const unsubscribe = this.session.subscribe(() => {
			this.dirty = true;
			this.wake?.();
		});

		let failures = 0;

		try {
			while (!signal.aborted) {
				// oxlint-disable-next-line no-await-in-loop -- one push at a time keeps the order.
				await this.untilDirty(signal);

				if (signal.aborted) {
					break;
				}

				try {
					this.dirty = false;
					// oxlint-disable-next-line no-await-in-loop -- see above.
					await this.catchUp(signal);
					failures = 0;
				} catch (cause) {
					if (signal.aborted) {
						break;
					}

					this.dirty = true;

					const waitMs = backoffDelay(
						failures,
						this.options.backoff,
						this.options.random ?? Math.random
					);

					failures += 1;
					this.options.log('relay-push-failed', {
						error: describeError(cause),
						attempt: failures,
						delayMs: waitMs
					});
					// oxlint-disable-next-line no-await-in-loop -- the backoff is the point.
					await delay(waitMs, undefined, { signal }).catch(() => undefined);
				}
			}
		} finally {
			unsubscribe();
		}
	}

	private untilDirty(signal: AbortSignal): Promise<void> {
		if (this.dirty || signal.aborted) {
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			const done = () => {
				this.wake = null;
				signal.removeEventListener('abort', done);
				resolve();
			};

			this.wake = done;
			signal.addEventListener('abort', done, { once: true });
		});
	}

	/** Pushes until the relay has everything the session holds now. */
	private async catchUp(signal: AbortSignal) {
		let stalled = 0;

		for (;;) {
			const target = this.session.position;
			const known = this.known;

			if (known?.epoch === target.epoch && known.seq === target.seq) {
				return;
			}

			const events = known?.epoch === target.epoch ? this.session.eventsAfter(known.seq) : null;

			// oxlint-disable-next-line no-await-in-loop -- each round depends on the relay's answer.
			const reached = await this.pushNext(known, events, signal);

			// A relay that keeps answering with the position we already knew will not move.
			stalled = reached.epoch === known?.epoch && reached.seq === known.seq ? stalled + 1 : 0;

			if (stalled >= 2) {
				throw new Error('the relay does not follow the session');
			}

			this.known = reached;
		}
	}

	/** The events the relay lacks when the log still has them, else the whole state. */
	private pushNext(
		known: Position | null,
		events: readonly RaceEvent[] | null,
		signal: AbortSignal
	): Promise<Position> {
		if (known && events) {
			const batch = events.slice(0, MAX_EVENTS_PER_PUSH);
			const body = { epoch: known.epoch, from: known.seq + 1, events: batch };

			return this.post('/ingest/events', JSON.stringify(body), signal);
		}

		this.options.log('relay-state-push', {});

		return this.post('/ingest/state', JSON.stringify(this.session.state()), signal);
	}

	private async post(route: string, body: string, signal: AbortSignal): Promise<Position> {
		const response = await this.fetchImpl(new URL(route, this.options.url), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.options.secret}`
			},
			body,
			signal: AbortSignal.any([signal, AbortSignal.timeout(PUSH_TIMEOUT_MS)])
		});

		// 409 is the relay saying where it stands, not a failure.
		if (!response.ok && response.status !== 409) {
			throw new Error(`relay answered ${response.status.toString()}`);
		}

		return positionSchema.parse(await response.json());
	}
}
