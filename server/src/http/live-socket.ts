import type { FastifyInstance } from 'fastify';

import type { LiveHub } from '../live/hub.js';
import { resumeQuerySchema } from '../live/protocol.js';

/** `WS /live`. Browsers send an Origin; one that is not allowed is refused before the upgrade. */
export function registerLiveSocket(app: FastifyInstance, hub: LiveHub) {
	app.get('/live', { websocket: true }, (socket, request) => {
		const resume = resumeQuerySchema.safeParse(request.query);

		hub.attach(socket, resume.success ? resume.data : null);
	});
}
