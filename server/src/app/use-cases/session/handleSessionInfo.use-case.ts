import type { WebSocketServer } from "ws";

import type { SessionEvent } from "../../../infra/f1-client/types/sync-events.types.js";
import type { SessionService } from "../../services/session.service.js";

export function handleSessionInfo(
  sessionService: SessionService,
  websocketServer: WebSocketServer,
) {
  return async (data: SessionEvent) => {
    const session = await sessionService.createAndCacheSession(data);
    websocketServer.clients.forEach((client) => {
      client.send(
        JSON.stringify({
          topic: "SessionInfo",
          data: session,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  };
}
