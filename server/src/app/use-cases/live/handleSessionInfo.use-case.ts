import type { Topic } from "../../../infra/f1-client/types/constants.js";
import type { LiveEventData } from "../../../infra/f1-client/types/live-events.types.js";
import type { WSServer } from "../../../infra/ws/WebSocketSever.js";
import type { SessionService } from "../../services/session.service.js";
import { Theme } from "../../types/topic.js";

export function handleSessionInfo(
  sessionService: SessionService,
  websocketServer: WSServer,
) {
  return async (data: LiveEventData[Topic.SESSION_INFO]) => {
    const session = await sessionService.createAndCacheSession(data);
    websocketServer.sendMessage(Theme.SESSION_INFO, session);
  };
}
