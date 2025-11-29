import { Cache } from "../../../infra/cache/Cache.js";
import { SessionRepository } from "../../../infra/db/repositories/session.repository.js";
import { Topic } from "../../../infra/f1-client/types/constants.js";
import { LiveEventData } from "../../../infra/f1-client/types/live-events.types.js";
import { Session } from "../../entities/Session.js";
import { fromSessionEventType } from "../session/session.mapper.js";

export function handleSessionInfo(cache: Cache, sessionRepository: SessionRepository) {
  return async (data: LiveEventData[Topic.SESSION_INFO]) => {
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
  }
}