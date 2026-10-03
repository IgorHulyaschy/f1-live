import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { catalogPathOf } from '../sinks/files.js';
import type { ImportReport } from './run.js';

const LARGEST = 3;

export interface OutputDigest {
	/** Over every file's name and bytes, in name order. */
	sha256: string;
	files: number;
	bytes: number;
}

/** A digest of everything under `<data>/out`; equal digests mean byte-identical outputs. */
export async function hashOutputs(dataDir: string): Promise<OutputDigest> {
	const root = path.dirname(catalogPathOf(dataDir));

	const names = (await readdir(root, { recursive: true, withFileTypes: true }))
		.filter((entry) => entry.isFile())
		.map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
		.toSorted();

	const hash = createHash('sha256');
	let bytes = 0;

	for (const name of names) {
		const content = await readFile(path.join(root, name));

		hash.update(`${name}\0`);
		hash.update(content);
		bytes += content.length;
	}

	return { sha256: hash.digest('hex'), files: names.length, bytes };
}

function megabytes(bytes: number): string {
	return `${(bytes / 1e6).toFixed(1)} MB`;
}

/** The text summary an import prints: counts, failures with reasons, sizes, time and the digest. */
export function formatReport(report: ImportReport, outputs: OutputDigest): string {
	const imported = report.outcomes.filter((outcome) => outcome.failure === null);
	const failed = report.outcomes.filter((outcome) => outcome.failure !== null);

	const largest = imported
		.flatMap((outcome) => (outcome.result === null ? [] : [{ outcome, result: outcome.result }]))
		.toSorted((a, b) => b.result.snapshotBytes - a.result.snapshotBytes)
		.slice(0, LARGEST);

	const built = imported.flatMap((outcome) =>
		outcome.result?.telemetry.status === 'built'
			? [{ outcome, bytes: outcome.result.telemetry.bytes }]
			: []
	);

	const telemetryFailed = imported.flatMap((outcome) =>
		outcome.result?.telemetry.status === 'failed'
			? [{ outcome, reason: outcome.result.telemetry.reason }]
			: []
	);

	const telemetrySkipped = imported.filter(
		(outcome) => outcome.result?.telemetry.status === 'skipped'
	);

	const decodeErrors = imported.filter((outcome) => (outcome.result?.failures.length ?? 0) > 0);

	return [
		`imported: ${imported.length}`,
		`failed: ${failed.length}`,
		...failed.map((outcome) => `  ${outcome.label} (${outcome.key}): ${outcome.failure}`),
		`skipped: ${report.skipped.length}`,
		`sessions with decode errors: ${decodeErrors.length}`,
		...decodeErrors.map(
			(outcome) =>
				`  ${outcome.label} (${outcome.key}): ${outcome.result?.failures.map((failure) => `${failure.topic} x${failure.frames}`).join(', ')}`
		),
		`wall time: ${(report.wallMs / 1000).toFixed(1)} s`,
		`raw: ${megabytes(report.rawBytes)}`,
		`output: ${megabytes(outputs.bytes)}`,
		`sessions with telemetry: ${built.length}`,
		`telemetry skipped (no Position.z, no circuit key, no laps or no lap to draw the circuit from): ${telemetrySkipped.length}`,
		`telemetry failed: ${telemetryFailed.length}`,
		...telemetryFailed.map(
			({ outcome, reason }) => `  ${outcome.label} (${outcome.key}): ${reason}`
		),
		`telemetry size: ${megabytes(built.reduce((sum, { bytes }) => sum + bytes, 0))}`,
		`largest telemetry:`,
		...built
			.toSorted((a, b) => b.bytes - a.bytes)
			.slice(0, LARGEST)
			.map(({ outcome, bytes }) => `  ${outcome.label} (${outcome.key}): ${megabytes(bytes)}`),
		`largest snapshots (gzipped):`,
		...largest.map(
			({ outcome, result }) =>
				`  ${outcome.label} (${outcome.key}): ${(result.snapshotBytes / 1024).toFixed(1)} KB`
		),
		`outputs sha256: ${outputs.sha256} over ${outputs.files} files`
	].join('\n');
}
