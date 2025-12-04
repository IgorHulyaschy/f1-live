import type { Cache } from "../../../infra/cache/Cache.js";
import type { LapRepository } from "../../../infra/db/repositories/lap.repository.js";
import type { LogRepository } from "../../../infra/db/repositories/log.repository.js";
import { Topic } from "../../../infra/f1-client/types/constants.js";
import type {
  LiveEvent,
  LiveEventData,
} from "../../../infra/f1-client/types/live-events.types.js";
import type { Logger } from "../../../infra/logger/index.js";
import type { WSServer } from "../../../infra/ws/WebSocketSever.js";
import type { SessionService } from "../../services/session.service.js";

import { handleSessionInfo } from "./handleSessionInfo.use-case.js";
import { handleTimingDataLiveUpdates } from "./handleTimingDataLiveUpdates.use-case.js";

export class LiveHandlerFactory {
  private readonly handlers: {
    [Topic.TIMING_DATA]: (
      data: LiveEventData[Topic.TIMING_DATA],
    ) => Promise<void>;
    [Topic.SESSION_INFO]: (
      data: LiveEventData[Topic.SESSION_INFO],
    ) => Promise<void>;
    [Topic.DRIVER_LIST]: (
      data: LiveEventData[Topic.DRIVER_LIST],
    ) => Promise<void>;
  };
  constructor(
    private readonly logger: Logger,
    cache: Cache,
    lapRepository: LapRepository,
    sessionService: SessionService,
    private readonly logRepository: LogRepository,
    private readonly websocketServer: WSServer,
  ) {
    this.handlers = {
      [Topic.TIMING_DATA]: handleTimingDataLiveUpdates(
        cache,
        lapRepository,
        this.websocketServer,
      ),
      [Topic.SESSION_INFO]: handleSessionInfo(
        sessionService,
        this.websocketServer,
      ),
      [Topic.DRIVER_LIST]: (_data: LiveEventData[Topic.DRIVER_LIST]) =>
        Promise.resolve(),
    };
  }

  async handleLiveUpdates<TTopic extends Topic>([
    topic,
    data,
    _timestamp,
  ]: LiveEvent<TTopic>) {
    await this.logRepository.create({
      topic,
      eventData: data,
    });

    const handler = this.getHandler(topic);
    if (!handler) {
      this.logger.error(`No handler found for topic: ${topic}`);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(data as any);
  }

  private getHandler(topic: Topic) {
    return this.handlers[topic];
  }
}
