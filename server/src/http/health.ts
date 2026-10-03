import type { FastifyInstance } from 'fastify';

import type { Mode } from '../config.js';
import type { LiveHub } from '../live/hub.js';
import type { LiveSession } from '../live/session.js';

export interface HealthSources {
	mode: Mode;
	session: LiveSession;
	/** Absent in ingest mode, which has no viewers. */
	hub?: LiveHub;
}

export function registerHealth(app: FastifyInstance, { mode, session, hub }: HealthSources) {
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
}
