import { WebSocketServer } from "ws";

import type { Topic } from "../../app/types/topic.js";

export class WSServer extends WebSocketServer {
  sendMessage(topic: Topic, data: Record<string, unknown>) {
    this.clients.forEach((client) => {
      client.send(JSON.stringify([topic, data]));
    });
  }
}
