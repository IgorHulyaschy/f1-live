import type { Cache } from "../../../infra/cache/Cache.js";
import type { SessionRepository } from "../../../infra/db/repositories/session.repository.js";
import type { SessionEvent } from "../../../infra/f1-client/types/sync-events.types.js";
import { Session } from "../../entities/Session.js";
import { fromSessionEventType } from "./session.mapper.js";

export function handleSessionInfo(
  sessionRepository: SessionRepository,
  cache: Cache
) {
  return async (data: SessionEvent) => {
    const existingSession = await sessionRepository.findOne(
      data.Meeting.Name,
      fromSessionEventType(data.Name)
    );

    if (existingSession) {
      cache.sessionId = existingSession.id;
      return;
    }

    const session = Session.create({
      name: data.Meeting.Name,
      country: data.Meeting.Country.Code,
      type: fromSessionEventType(data.Name),
    });
    cache.sessionId = session.id;

    await sessionRepository.create(session);
  };
}
