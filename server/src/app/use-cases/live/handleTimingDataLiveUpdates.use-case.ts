import type { Cache } from "../../../infra/cache/Cache.js";
import type { LapRepository } from "../../../infra/db/repositories/lap.repository.js";
import type { Topic } from "../../../infra/f1-client/types/constants.js";
import type {
  LiveEventData,
  SectorData,
} from "../../../infra/f1-client/types/live-events.types.js";
import type { WSServer } from "../../../infra/ws/WebSocketSever.js";
import { parseTime } from "../../../pkg/time.js";
import { Lap } from "../../entities/Lap.js";
import { Theme } from "../../types/topic.js";

export function handleTimingDataLiveUpdates(
  cache: Cache,
  lapRepository: LapRepository,
  websocketServer: WSServer,
) {
  function parseDriverChunk(
    lapToUpdate: Lap,
    sectors?: { [key: string]: SectorData },
    lastLapTime?: { Value: string },
    lapNumber?: number,
  ) {
    if (sectors) {
      for (const [sectorNumber, sectorData] of Object.entries(sectors)) {
        parseSector(lapToUpdate, sectorNumber, sectorData);
      }
    }

    if (lastLapTime?.Value) {
      lapToUpdate.time = parseTime(lastLapTime.Value);
    }

    if (lapNumber) {
      lapToUpdate.lapNumber = lapNumber;
    }
  }

  function parseSector(
    lapToUpdate: Lap,
    sectorNumber: string,
    sectorData: SectorData,
  ) {
    if ("Value" in sectorData) {
      lapToUpdate.sector1Time =
        sectorNumber === "0" && sectorData.Value
          ? parseTime(sectorData.Value)
          : lapToUpdate.sector1Time;
      lapToUpdate.sector2Time =
        sectorNumber === "1" && sectorData.Value
          ? parseTime(sectorData.Value)
          : lapToUpdate.sector2Time;
      lapToUpdate.sector3Time =
        sectorNumber === "2" && sectorData.Value
          ? parseTime(sectorData.Value)
          : lapToUpdate.sector3Time;
    }
  }

  return async (data: LiveEventData[Topic.TIMING_DATA]) => {
    if (data.Lines) {
      for (const [key, value] of Object.entries(data.Lines)) {
        const driverLastLap = await lapRepository.findLastLap(
          key,
          cache.sessionId,
        );

        // In case of first lap or last lap was completed
        if (!driverLastLap || driverLastLap?.time) {
          const lap = Lap.create({
            driverNumber: key,
            sessionId: cache.sessionId,
            lapNumber: driverLastLap
              ? (value.NumberOfLaps || driverLastLap.lapNumber) + 1
              : 1,
          });

          parseDriverChunk(
            lap,
            value.Sectors,
            value.LastLapTime,
            value.NumberOfLaps,
          );
          if (lap.sector1Time) {
            await lapRepository.create(lap);
            websocketServer.sendMessage(
              Theme.LAP_INFO,
              lap as unknown as Record<string, unknown>,
            );
          }
        }

        // In case last lap not completed
        if (driverLastLap && !driverLastLap.time) {
          parseDriverChunk(
            driverLastLap,
            value.Sectors,
            value.LastLapTime,
            value.NumberOfLaps,
          );
          await lapRepository.update(driverLastLap);
          websocketServer.sendMessage(
            Theme.LAP_INFO,
            driverLastLap as unknown as Record<string, unknown>,
          );
        }
      }
    }
  };
}
