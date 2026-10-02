import { WebSocketServer } from 'ws';

import type { Lap } from '../../app/entities/Lap.js';
import type { Session } from '../../app/entities/Session.js';
import type { Theme } from '../../app/types/topic.js';

export type ServerMessage = [typeof Theme.SESSION_INFO, Session] | [typeof Theme.LAP_INFO, Lap];

export class WSServer extends WebSocketServer {
	constructor(port: number) {
		super({ port });
	}

	sendMessage(message: ServerMessage) {
		const payload = JSON.stringify(message);

		for (const client of this.clients) {
			client.send(payload);
		}
	}

	stop() {
		for (const client of this.clients) {
			client.close();
		}

		this.close();
	}
}
