import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { TelemetryOnDemand } from '../telemetry/on-demand.js';

const paramsSchema = z.object({ key: z.coerce.number().int().positive() });

/** A session's telemetry manifest, the first file a viewer reads when it opens the session. */
const MANIFEST_PATH = /^\/telemetry\/(\d+)\/index\.json(?:\?|$)/;

function keyOf(request: FastifyRequest) {
	return paramsSchema.safeParse(request.params);
}

/**
 * `GET /telemetry-fetch/<key>` says where an older session's telemetry is; `POST` starts fetching
 * it from the archive, or tries again after a failure. Both answer a `TelemetryFetchStatus`.
 */
export function registerTelemetryFetch(app: FastifyInstance, onDemand: TelemetryOnDemand) {
	app.get('/telemetry-fetch/:key', async (request, reply) => {
		const params = keyOf(request);

		if (!params.success) {
			return reply.code(404).send({ error: 'not found' });
		}

		return reply.header('Cache-Control', 'no-store').send(await onDemand.status(params.data.key));
	});

	app.post('/telemetry-fetch/:key', async (request, reply) => {
		const params = keyOf(request);

		if (!params.success) {
			return reply.code(404).send({ error: 'not found' });
		}

		return reply.header('Cache-Control', 'no-store').send(await onDemand.request(params.data.key));
	});

	// Opening a cached session keeps it from eviction longest.
	app.addHook('onResponse', async (request, reply) => {
		const match = MANIFEST_PATH.exec(request.url);

		if (match !== null && (reply.statusCode === 200 || reply.statusCode === 304)) {
			await onDemand.opened(Number(match[1])).catch((cause: unknown) => {
				request.log.warn({ err: cause }, 'telemetry-cache-touch-failed');
			});
		}
	});
}
