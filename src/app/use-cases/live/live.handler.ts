import { Cache } from "../../../infra/cache/Cache.js";
import { LapRepository } from "../../../infra/db/repositories/lap.repository.js";
import { LogRepository } from "../../../infra/db/repositories/log.repository.js";
import { SessionRepository } from "../../../infra/db/repositories/session.repository.js";
import { Topic } from "../../../infra/f1-client/types/constants.js";
import {
  LiveEvent,
  LiveEventData,
} from "../../../infra/f1-client/types/live-events.types.js";
import { Logger } from "../../../infra/logger/index.js";
import { handleSessionInfo } from "./handleSessionInfo.use-case.js";
import { handleTimingDataLiveUpdates } from "./handleTimingDataLiveUpdates.use-case.js";

export class LiveHandlerFactory {
  private readonly handlers: {
    [Topic.TIMING_DATA]: (
      data: LiveEventData[Topic.TIMING_DATA]
    ) => Promise<void>;
    [Topic.SESSION_INFO]: (
      data: LiveEventData[Topic.SESSION_INFO]
    ) => Promise<void>;
    [Topic.DRIVER_LIST]: (
      data: LiveEventData[Topic.DRIVER_LIST]
    ) => Promise<void>;
  };
  constructor(
    private readonly logger: Logger,
    private readonly cache: Cache,
    private readonly lapRepository: LapRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly logRepository: LogRepository
  ) {
    this.handlers = {
      [Topic.TIMING_DATA]: handleTimingDataLiveUpdates(
        this.cache,
        this.lapRepository
      ),
      [Topic.SESSION_INFO]: handleSessionInfo(
        this.cache,
        this.sessionRepository
      ),
      [Topic.DRIVER_LIST]: (_data: LiveEventData[Topic.DRIVER_LIST]) =>
        Promise.resolve(),
    };
  }

  async handleLiveUpdates<TTopic extends Topic = Topic>([
    topic,
    data,
    _timestamp,
  ]: LiveEvent<TTopic>) {
    const handler = this.getHandler(topic);
    if (!handler) {
      this.logger.error(`No handler found for topic: ${topic}`);
      return;
    }

    await this.logRepository.create({
      topic,
      eventData: data,
    });

    await handler(data as any);
  }

  private getHandler(topic: Topic) {
    return this.handlers[topic];
  }
}
