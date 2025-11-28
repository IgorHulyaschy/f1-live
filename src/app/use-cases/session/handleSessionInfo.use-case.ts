import type { SessionRepository } from "../../../infra/db/repositories/session.repository.js";
import type { SessionEvent } from "../../../infra/f1-client/types/sync-events.types.js";
import { Session } from "../../entities/Session.js";
import { fromSessionEventType } from "./session.mapper.js";

export function handleSessionInfo(sessionRepository: SessionRepository) {
  return async (data: SessionEvent) => {
    const session = Session.create({
      name: data.Meeting.Name,
      country: data.Meeting.Country.Code,
      type: fromSessionEventType(data.Type),
    });

    await sessionRepository.create(session);
  };
}
