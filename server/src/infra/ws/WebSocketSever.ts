import { WebSocketServer } from "ws";

import type { Theme } from "../../app/types/topic.js";
import type { Logger } from "../logger/index.js";

export class WSServer extends WebSocketServer {
  constructor(
    private readonly logger: Logger,
    port: number,
  ) {
    super({ port });
  }
  sendMessage(topic: Theme, data: Record<string, unknown>) {
    this.clients.forEach((client) => {
      client.send(JSON.stringify([topic, data]));
    });
  }

  init() {
    this.on("connection", (socket) => {
      this.logger.info("WebSocket connection handling");
      socket.send("Connection established");
    });

    this.on("error", (error) => this.logger.error(error));
  }
}
