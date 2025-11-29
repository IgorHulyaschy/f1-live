import type { Topic } from "../../../infra/f1-client/types/constants.js";
import type { LiveEventData } from "../../../infra/f1-client/types/live-events.types.js";
import type { SessionService } from "../../services/session.service.js";

export function handleSessionInfo(sessionService: SessionService) {
  return async (data: LiveEventData[Topic.SESSION_INFO]) => {
    await sessionService.createAndCacheSession(data);
  };
}
