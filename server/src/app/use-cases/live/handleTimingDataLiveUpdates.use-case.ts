import type { Cache } from '../../../infra/cache/Cache.js';
import type { LapRepository } from '../../../infra/db/repositories/lap.repository.js';
import type {
	LiveTimingDataEvent,
	SectorData,
	TimingDataLine
} from '../../../infra/f1-client/types/live-events.types.js';
import type { WSServer } from '../../../infra/ws/WebSocketSever.js';
import { parseTime } from '../../../pkg/time.js';
import { Lap } from '../../entities/Lap.js';
import { Theme } from '../../types/topic.js';

function applySector(lapToUpdate: Lap, sectorIndex: string, sectorData: SectorData) {
	if (!('Value' in sectorData) || !sectorData.Value) {
		return;
	}

	const time = parseTime(sectorData.Value);

	if (sectorIndex === '0') {
		lapToUpdate.sector1Time = time;
	} else if (sectorIndex === '1') {
		lapToUpdate.sector2Time = time;
	} else if (sectorIndex === '2') {
		lapToUpdate.sector3Time = time;
	}
}

function applyLine(lapToUpdate: Lap, line: TimingDataLine) {
	for (const [sectorIndex, sectorData] of Object.entries(line.Sectors ?? {})) {
		applySector(lapToUpdate, sectorIndex, sectorData);
	}

	if (line.LastLapTime?.Value) {
		lapToUpdate.time = parseTime(line.LastLapTime.Value);
	}

	if (line.NumberOfLaps) {
		lapToUpdate.lapNumber = line.NumberOfLaps;
	}
}

export function handleTimingDataLiveUpdates(
	cache: Cache,
	lapRepository: LapRepository,
	websocketServer: WSServer
) {
	async function handleDriverLine(driverNumber: string, line: TimingDataLine) {
		const driverLastLap = await lapRepository.findLastLap(driverNumber, cache.sessionId);

		// The previous lap is complete (or there is none): this chunk starts a new lap.
		if (!driverLastLap || driverLastLap.time) {
			const lap = Lap.create({
				driverNumber,
				sessionId: cache.sessionId,
				lapNumber: driverLastLap ? (line.NumberOfLaps || driverLastLap.lapNumber) + 1 : 1
			});

			applyLine(lap, line);

			if (lap.sector1Time) {
				await lapRepository.create(lap);
				websocketServer.sendMessage([Theme.LAP_INFO, lap]);
			}

			return;
		}

		// The previous lap is still running: this chunk completes more of it.
		applyLine(driverLastLap, line);
		await lapRepository.update(driverLastLap);
		websocketServer.sendMessage([Theme.LAP_INFO, driverLastLap]);
	}

	return async (data: LiveTimingDataEvent) => {
		await Promise.all(
			Object.entries(data.Lines ?? {}).map(([driverNumber, line]) =>
				handleDriverLine(driverNumber, line)
			)
		);
	};
}
