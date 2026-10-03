import type { LapTelemetry } from '@f1-live/shared';

import { speedRun, valueAtTime } from '../../insights/gap-distance.ts';

/**
 * One car's lap as the ghost lap runs it: its official time, and how far along the lap it is at
 * each moment of that time. Distance comes from the speed channel, scaled to the lap's length:
 * positions jump by metres between samples, which would shuffle cars a few metres apart.
 */
export type GhostTrack = {
	driverNumber: string;
	lapMs: number;
	/** Official milliseconds since the line, rising. */
	t: number[];
	/** Metres along the lap at each `t`, from 0 to the lap's length. */
	d: number[];
};

export function ghostTrack(
	telemetry: Pick<LapTelemetry, 'driverNumber' | 't' | 'd' | 'speed' | 'lapTimeMs'>,
	lapMs: number
): GhostTrack {
	const scale = telemetry.lapTimeMs > 0 ? lapMs / telemetry.lapTimeMs : 1;
	const t = telemetry.t.map((time) => time * scale);
	const length = telemetry.d.at(-1) ?? 0;
	const speed = telemetry.speed;

	if (!speed || speed.length !== telemetry.t.length || length <= 0) {
		return { driverNumber: telemetry.driverNumber, lapMs, t, d: [...telemetry.d] };
	}

	const run = speedRun(telemetry.t, speed);

	const total = run.at(-1) ?? 0;

	return {
		driverNumber: telemetry.driverNumber,
		lapMs,
		t,
		d: run.map((metres) => (total > 0 ? (metres * length) / total : metres))
	};
}

/** Metres along the lap at `ms` into it; at the line once the lap is done. */
export function ghostDistance(track: GhostTrack, ms: number): number {
	return ms >= track.lapMs ? (track.d.at(-1) ?? 0) : valueAtTime(track.t, track.d, Math.max(0, ms));
}

/** Who leads the ghost lap at `ms`, and every car's metres behind, the leader first. */
export function ghostOrder(
	tracks: readonly GhostTrack[],
	ms: number
): { driverNumber: string; metres: number; behindM: number }[] {
	const along = tracks
		.map((track) => ({ driverNumber: track.driverNumber, metres: ghostDistance(track, ms) }))
		.toSorted((a, b) => b.metres - a.metres);

	const lead = along[0]?.metres ?? 0;

	return along.map((car) => ({ ...car, behindM: lead - car.metres }));
}
