/* eslint-disable @typescript-eslint/no-misused-promises */
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

export async function main() {
  const fastify = Fastify();

  const logger = new Logger();
  const cache = new Cache();

  const pool = new Pool({ connectionString: config.database.url });
  const db = drizzle(pool);
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
      SessionInfo: handleSessionInfo(sessionService),
      DriverList: handleDriverList(driverRepository),
      TimingData: () => ({}),
    },
    new LiveHandlerFactory(
      logger,
      cache,
      lapRepository,
      sessionService,
      logRepository,
    ),
  );

  fastify.get(
    "/onLoad",
    onLoad(cache, lapRepository, driverRepository, sessionRepository),
  );

  fastify.listen({ port: 3000 }, (err, address) => {
    if (err) logger.error(err);
    logger.info(`Server is running on ${address}`);
  });

  process.on("SIGTERM", async () => {
    liveTimingClient.stop();
    await pool.end();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    liveTimingClient.stop();
    await pool.end();
    process.exit(0);
  });

  return { liveTimingClient, db };
}
