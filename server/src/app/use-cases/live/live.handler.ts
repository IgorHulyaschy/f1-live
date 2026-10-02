import type { Cache } from '../../../infra/cache/Cache.js';
import type { LapRepository } from '../../../infra/db/repositories/lap.repository.js';
import type { LogRepository } from '../../../infra/db/repositories/log.repository.js';
import { Topic } from '../../../infra/f1-client/types/constants.js';
import type { LiveEvent } from '../../../infra/f1-client/types/live-events.types.js';
import type { WSServer } from '../../../infra/ws/WebSocketSever.js';
import type { SessionService } from '../../services/session.service.js';

import { handleSessionInfo } from './handleSessionInfo.use-case.js';
import { handleTimingDataLiveUpdates } from './handleTimingDataLiveUpdates.use-case.js';

export type LiveHandlerDependencies = {
	cache: Cache;
	lapRepository: LapRepository;
	logRepository: LogRepository;
	sessionService: SessionService;
	websocketServer: WSServer;
};

export class LiveHandlerFactory {
	private readonly logRepository: LogRepository;
	private readonly onTimingData: ReturnType<typeof handleTimingDataLiveUpdates>;
	private readonly onSessionInfo: ReturnType<typeof handleSessionInfo>;

	constructor(dependencies: LiveHandlerDependencies) {
		this.logRepository = dependencies.logRepository;
		this.onTimingData = handleTimingDataLiveUpdates(
			dependencies.cache,
			dependencies.lapRepository,
			dependencies.websocketServer
		);
		this.onSessionInfo = handleSessionInfo(
			dependencies.sessionService,
			dependencies.websocketServer
		);
	}

	async handleLiveUpdates(event: LiveEvent) {
		await this.logRepository.create({ topic: event[0], eventData: event[1] });

		switch (event[0]) {
			case Topic.TIMING_DATA:
				await this.onTimingData(event[1]);
				break;
			case Topic.SESSION_INFO:
				await this.onSessionInfo(event[1]);
				break;
			case Topic.DRIVER_LIST:
				// The snapshot handler stores the driver list; mid-session changes are not tracked yet.
				break;
		}
	}
}
