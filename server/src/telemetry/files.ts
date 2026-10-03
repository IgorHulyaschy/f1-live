import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { TELEMETRY_VERSION } from '@f1-live/shared';
import type {
	LapIndex,
	LapTelemetry,
	ReplayChunk,
	ReplayManifest,
	TrackOutline
} from '@f1-live/shared';
import { z } from 'zod';

const pointSchema = z.tuple([z.number(), z.number()]);

const outlineSchema = z.object({
	v: z.literal(TELEMETRY_VERSION),
	circuitKey: z.string(),
	name: z.string(),
	lengthM: z.number().positive(),
	points: z.array(pointSchema).min(8),
	rotationDeg: z.number(),
	sectorBoundariesM: z.tuple([z.number(), z.number()]),
	miniSectorsPerSector: z.tuple([z.number(), z.number(), z.number()]),
	miniSectorStartsM: z.array(z.number()).min(3),
	pitLane: z
		.object({ points: z.array(pointSchema), entryM: z.number(), exitM: z.number() })
		.nullable(),
	source: z.object({
		sessionKey: z.number(),
		driverNumber: z.string(),
		lap: z.number(),
		lapTimeMs: z.number(),
		miniSectors: z.enum(['timing', 'even'])
	})
});

/** Where the telemetry of every session and circuit goes: `<DATA_DIR>/out/telemetry`. */
export function telemetryDir(dataDir: string): string {
	return path.join(dataDir, 'out', 'telemetry');
}

function circuitFile(dataDir: string, circuitKey: string): string {
	return path.join(telemetryDir(dataDir), 'circuits', `${circuitKey}.json`);
}

/** The circuit's saved outline; null when there is none or it is in a format that is gone. */
export async function readOutline(
	dataDir: string,
	circuitKey: string
): Promise<TrackOutline | null> {
	try {
		const text = await readFile(circuitFile(dataDir, circuitKey), 'utf8');
		const parsed = outlineSchema.safeParse(JSON.parse(text));

		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export async function writeOutline(dataDir: string, outline: TrackOutline): Promise<void> {
	const file = circuitFile(dataDir, outline.circuitKey);

	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify(outline));
}

/** What a session's telemetry folder holds besides the plain-JSON manifests. */
export type TelemetryFile = LapTelemetry | LapIndex | ReplayChunk;

export type TelemetryManifest = ReplayManifest | SessionManifest;

/** The first file to read: where the rest of a session's telemetry is. */
export interface SessionManifest {
	v: typeof TELEMETRY_VERSION;
	sessionKey: number;
	circuitKey: string;
	/** ISO 8601 UTC. */
	builtAt: string;
	hasCarData: boolean;
	/** Paths inside the session's folder. */
	laps: string;
	replay: string;
}

/** Gzipped JSON, as every other file of a session's output. */
export function gzipJson(value: TelemetryFile): Buffer {
	return gzipSync(JSON.stringify(value), { level: 9 });
}

/**
 * Writes a session's folder somewhere beside it and moves it into place, so a reader never sees
 * half of a rebuild.
 */
export async function replaceFolder(
	target: string,
	write: (folder: string) => Promise<void>
): Promise<void> {
	const staging = `${target}.tmp`;

	await rm(staging, { recursive: true, force: true });
	await mkdir(staging, { recursive: true });
	await write(staging);
	await rm(target, { recursive: true, force: true });
	await rename(staging, target);
}

export function manifestJson(value: TelemetryManifest): string {
	return JSON.stringify(value);
}
