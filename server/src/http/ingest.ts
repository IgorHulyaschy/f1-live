import { createHash, timingSafeEqual } from 'node:crypto';

import type { RaceEvent, RaceSnapshot } from '@f1-live/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { LiveHub } from '../live/hub.js';
import { CHANNELS, PROTOCOL_VERSION } from '../live/protocol.js';
import type { StateMessage } from '../live/protocol.js';
import type { LiveSession } from '../live/session.js';

/** A full snapshot of a long race is a few megabytes. */
const INGEST_BODY_LIMIT = 64 * 1024 * 1024;

/**
 * The sender holds the shared secret and is this codebase's own ingest process, so only the
 * outer shape of events and snapshots is checked; the reducer's types are not duplicated as a
 * schema.
 */
const pushedEventSchema = z.object({ kind: z.string(), at: z.string() }).loose();

const pushedSnapshotSchema = z.object({ session: z.object({ id: z.string() }).loose() }).loose();

const eventsBodySchema = z.object({
	epoch: z.string().min(1),
	from: z.number().int().min(1),
	events: z.array(z.custom<RaceEvent>((value) => pushedEventSchema.safeParse(value).success))
});

const stateBodySchema = z.object({
	epoch: z.string().min(1),
	sessionId: z.string().nullable(),
	seq: z.number().int().min(0),
	at: z.number(),
	snapshot: z.custom<RaceSnapshot>((value) => pushedSnapshotSchema.safeParse(value).success)
});

/** Car numbers map to the arrays `LiveTelemetry` makes; a viewer's client reads them as they are. */
const carsSchema = z.record(z.string(), z.array(z.number()));

const channelMessageSchema = z.discriminatedUnion('type', [
	z.object({
		v: z.literal(PROTOCOL_VERSION),
		type: z.literal('positions'),
		at: z.number(),
		cars: carsSchema
	}),
	z.object({
		v: z.literal(PROTOCOL_VERSION),
		type: z.literal('car_data'),
		at: z.number(),
		cars: carsSchema
	})
]);

const channelsBodySchema = z.object({ messages: z.array(channelMessageSchema).max(2) });

function digest(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

/** Compares digests, so neither the length nor the content of the secret shows in the timing. */
function hasSecret(request: FastifyRequest, expected: Buffer): boolean {
	const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? '');

	return match?.[1] !== undefined && timingSafeEqual(digest(match[1]), expected);
}

/**
 * Relay side of the split: `POST /ingest/events` and `POST /ingest/state` from the ingest
 * process, behind the shared secret. Both answer with the position of the relay's copy.
 * `POST /ingest/channels` hands the opt-in telemetry messages to the hub, which sends them to the
 * viewers that subscribed.
 */
export function registerIngest(
	app: FastifyInstance,
	session: LiveSession,
	hub: LiveHub,
	secret: string
) {
	const expected = digest(secret);

	app.register((scope, _options, done) => {
		scope.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
			if (!hasSecret(request, expected)) {
				await reply.code(401).send({ error: 'unauthorized' });
			}
		});

		scope.post('/ingest/events', { bodyLimit: INGEST_BODY_LIMIT }, async (request, reply) => {
			const body = eventsBodySchema.safeParse(request.body);

			if (!body.success) {
				return reply.code(400).send({ error: 'invalid events body' });
			}

			const result = session.replicate(body.data.epoch, body.data.from, body.data.events);

			if (result.applied) {
				for (const event of result.skipped) {
					request.log.warn({ event: 'ingest-event-skipped', ...event }, 'ingest-event-skipped');
				}

				return session.position;
			}

			return reply.code(409).send(result.position);
		});

		scope.post('/ingest/state', { bodyLimit: INGEST_BODY_LIMIT }, async (request, reply) => {
			const body = stateBodySchema.safeParse(request.body);

			if (!body.success) {
				return reply.code(400).send({ error: 'invalid state body' });
			}

			const state: StateMessage = { ...body.data, v: PROTOCOL_VERSION, type: 'state' };

			session.adopt(state);

			return session.position;
		});

		scope.post('/ingest/channels', async (request, reply) => {
			const body = channelsBodySchema.safeParse(request.body);

			if (!body.success) {
				return reply.code(400).send({ error: 'invalid channels body' });
			}

			for (const message of body.data.messages) {
				hub.markLive(message.type);
				hub.publish(message.type, JSON.stringify(message));
			}

			return { wanted: CHANNELS.filter((channel) => hub.wants(channel)) };
		});

		done();
	});
}
