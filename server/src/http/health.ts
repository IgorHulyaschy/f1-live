import type { FastifyInstance } from 'fastify';

import type { Mode } from '../config.js';
import type { LiveHub } from '../live/hub.js';
import type { LiveSession } from '../live/session.js';

export interface HealthSources {
	mode: Mode;
	session: LiveSession;
	/** Absent in ingest mode, which has no viewers. */
	hub?: LiveHub;
	/** Why this process should not take traffic right now, or null when it can. */
	notReady: () => Promise<string | null>;
}

/**
 * `/health` is liveness: the process answers, so do not restart it. `/ready` is readiness: it can
 * do its job (the accounts database answers, shutdown has not begun), so route viewers to it.
 */
export function registerHealth(
	app: FastifyInstance,
	{ mode, session, hub, notReady }: HealthSources
) {
	app.get('/health', () => {
		const { epoch, seq } = session.position;

		return {
			status: 'ok',
			mode,
			sessionId: session.sessionId,
			epoch,
			seq,
			viewers: hub?.size ?? 0,
			uptimeSeconds: Math.round(process.uptime()),
			rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
		};
	});

	app.get('/ready', async (_request, reply) => {
		const problem = await notReady();

		return problem ? reply.code(503).send({ status: problem }) : { status: 'ready' };
	});
}
