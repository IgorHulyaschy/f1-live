import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "./config.js";
import { LiveTimingClient } from "./infra/f1-client/livetiming.client.js";
import { DriverRepository } from "./infra/db/repositories/driver.repository.js";
import { handlerTimingDataChunk } from "./module/handlerTimingDataChunk.js";

export async function main(): Promise<void> {
  const db = drizzle(config.database.url);
  const driverRepository = new DriverRepository(db);

  // controller
  const handlerTimingDataChunkCallback =
    handlerTimingDataChunk(driverRepository);

  const liveTimingClient = new LiveTimingClient(
    config.livetiming.negotiateUrl,
    config.livetiming.connectionUrl
  );

  await liveTimingClient.init();

  liveTimingClient.onMessage({
    TimingData: handlerTimingDataChunkCallback,
  });
}

void main();
