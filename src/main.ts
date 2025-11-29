/* eslint-disable @typescript-eslint/no-misused-promises */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "./config.js";
import { LiveTimingClient } from "./infra/f1-client/livetiming.client.js";
import { DriverRepository } from "./infra/db/repositories/driver.repository.js";
import { SessionRepository } from "./infra/db/repositories/session.repository.js";
import { handleSessionInfo } from "./app/use-cases/session/handleSessionInfo.use-case.js";
import { Logger } from "./infra/logger/index.js";
import { handleDriverList } from "./app/use-cases/driver/handleDriverList.use-case.js";
import { Cache } from "./infra/cache/Cache.js";
import { LiveHandlerFactory } from "./app/use-cases/live/live.handler.js";
import { LapRepository } from "./infra/db/repositories/lap.repository.js";

export async function main() {
  const logger = new Logger();
  const cache = new Cache();

  const pool = new Pool({ connectionString: config.database.url });
  const db = drizzle(pool);
  const driverRepository = new DriverRepository(db);
  const sessionRepository = new SessionRepository(db);
  const lapRepository = new LapRepository(db);

  const liveTimingClient = new LiveTimingClient(
    logger,
    config.livetiming.negotiateUrl,
    config.livetiming.connectionUrl
  );

  await liveTimingClient.init();

  liveTimingClient.onMessage(
    {
      SessionInfo: handleSessionInfo(sessionRepository, cache),
      DriverList: handleDriverList(driverRepository),
      TimingData: () => ({}),
    },
    new LiveHandlerFactory(logger, cache, lapRepository, sessionRepository)
  );

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
