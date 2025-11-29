import type { SessionEvent } from "../../../infra/f1-client/types/sync-events.types.js";
import type { SessionService } from "../../services/session.service.js";

export function handleSessionInfo(sessionService: SessionService) {
  return async (data: SessionEvent) => {
    await sessionService.createAndCacheSession(data);
  };
}
