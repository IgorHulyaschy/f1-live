import { Topic } from "../../../infra/f1-client/types/constants.js";
import type { LiveEventData } from "../../../infra/f1-client/types/live-events.types.js";
import type { WSServer } from "../../../infra/ws/WebSocketSever.js";
import type { SessionService } from "../../services/session.service.js";

export function handleSessionInfo(
  sessionService: SessionService,
  websocketServer: WSServer,
) {
  return async (data: LiveEventData[Topic.SESSION_INFO]) => {
    const session = await sessionService.createAndCacheSession(data);
    websocketServer.sendMessage(Topic.SESSION_INFO, session);
  };
}
