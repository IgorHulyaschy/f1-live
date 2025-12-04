/* eslint-disable @typescript-eslint/no-misused-promises */
import cors from "@fastify/cors";
import { drizzle } from "drizzle-orm/node-postgres";
import Fastify from "fastify";
import { Pool } from "pg";

import { onLoad } from "./api/http/onLoad.js";
import { SessionService } from "./app/services/session.service.js";
import { handleDriverList } from "./app/use-cases/driver/handleDriverList.use-case.js";
import { LiveHandlerFactory } from "./app/use-cases/live/live.handler.js";
import { handleSessionInfo } from "./app/use-cases/session/handleSessionInfo.use-case.js";
import { config } from "./config.js";
import { Cache } from "./infra/cache/Cache.js";
import { DriverRepository } from "./infra/db/repositories/driver.repository.js";
import { LapRepository } from "./infra/db/repositories/lap.repository.js";
import { LogRepository } from "./infra/db/repositories/log.repository.js";
import { SessionRepository } from "./infra/db/repositories/session.repository.js";
import { LiveTimingClient } from "./infra/f1-client/livetiming.client.js";
import { Logger } from "./infra/logger/index.js";
import { WSServer } from "./infra/ws/WebSocketSever.js";

export async function main() {
  const pool = new Pool({ connectionString: config.database.url });
  const db = drizzle(pool);
  const logger = new Logger();
  const cache = new Cache();

  const fastify = Fastify();
  const websocketServer = new WSServer(logger, config.app.wsPort);

  const driverRepository = new DriverRepository(db);
  const sessionRepository = new SessionRepository(db);
  const lapRepository = new LapRepository(db);
  const logRepository = new LogRepository(db);

  const sessionService = new SessionService(cache, sessionRepository);

  const liveTimingClient = new LiveTimingClient(
    logger,
    config.livetiming.negotiateUrl,
    config.livetiming.connectionUrl,
  );

  await liveTimingClient.init();
  liveTimingClient.onMessage(
    {
      SessionInfo: handleSessionInfo(sessionService, websocketServer),
      DriverList: handleDriverList(driverRepository),
      TimingData: () => ({}),
    },
    new LiveHandlerFactory(
      logger,
      cache,
      lapRepository,
      sessionService,
      logRepository,
      websocketServer,
    ),
  );

  await fastify.register(cors, {
    // Your CORS options here
    origin: "*", // Allows all origins (for development, use specific origins in production)
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
  });

  fastify.get(
    "/onLoad",
    onLoad(cache, lapRepository, driverRepository, sessionRepository),
  );

  fastify.listen({ port: config.app.port }, (err, address) => {
    if (err) logger.error(err);
    logger.info(`Server is running on ${address}`);
  });

  fastify.addHook("onClose", async () => {
    liveTimingClient.stop();
    websocketServer.stop();
    await pool.end();
  });

  return { liveTimingClient, db };
}
