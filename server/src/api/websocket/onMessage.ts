import type { WebSocket } from "@fastify/websocket";
import type { FastifyRequest } from "fastify";

export function onMessage() {
  return async (socket: WebSocket, _req: FastifyRequest) => {
    socket.on("message", (message) => {
      socket.send(message);
    });
  };
}
