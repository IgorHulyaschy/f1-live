import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { ClassificationCorrectionEvent, Standing } from '@f1-live/shared';

import { ManualCorrections, parseManualCorrections } from '../sources/manual/corrections.js';
import { correctionsFromResult, parseSessionResult } from '../sources/openf1/session-result.js';
import type { SessionResultRow } from '../sources/openf1/session-result.js';
import { mergeCorrections } from './corrections.js';
import type { CorrectionTarget } from './corrections.js';

const roots: string[] = [];

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

function target(key: number): CorrectionTarget {
	return { key, endedAt: '', standings: [] };
}

function correction(
	driverNumber: string,
	kind: 'disqualified' | 'time_penalty',
	reason: string,
	at = '2025-11-23T06:00:00.000Z'
): ClassificationCorrectionEvent {
	return { kind: 'classification_correction', at, correction: { driverNumber, kind, reason } };
}

function row(
	driver: number,
	duration: number | null,
	extra: { dsq?: boolean; laps?: number | null } = {}
): SessionResultRow {
	return {
		session_key: 1,
		driver_number: driver,
		dsq: extra.dsq ?? false,
		number_of_laps: extra.laps === undefined ? 50 : extra.laps,
		duration
	};
}

function standing(driverNumber: string, position: number, gapToLeaderMs: number | null): Standing {
	return {
		driverNumber,
		position,
		gapToLeaderMs,
		intervalMs: null,
		lapsCompleted: 50,
		inPit: false,
		retired: false,
		disqualified: false
	};
}

const END = '2025-11-23T05:30:00.000Z';

/** The feed's final order: car 1 leads, 63 is 10 s behind, 12 is 20 s behind, 16 is 30 s behind. */
const FEED = [
	standing('1', 1, 0),
	standing('63', 2, 10_000),
	standing('12', 3, 20_000),
	standing('16', 4, 30_000)
];

function summary(
	events: readonly ClassificationCorrectionEvent[]
): [string, string, number | undefined][] {
	return events.map((event) => [
		event.correction.driverNumber,
		event.correction.kind,
		event.correction.seconds
	]);
}

function parse(rows: readonly SessionResultRow[]): SessionResultRow[] {
	return parseSessionResult(JSON.stringify(rows));
}

describe('correctionsFromResult', () => {
	it('turns a disqualified row of an OpenF1 session result into a correction at the end of the session', () => {
		const rows = parse([
			row(81, null, { dsq: true, laps: null }),
			row(1, 4800),
			row(4, null, { dsq: true, laps: null })
		]);

		const events = correctionsFromResult(rows, [], END);

		assert.deepEqual(summary(events), [
			['4', 'disqualified', undefined],
			['81', 'disqualified', undefined]
		]);
		assert.ok(events.every((event) => event.at === END));
	});

	it('finds nothing when the official times match the feed', () => {
		const rows = parse([row(1, 4800), row(63, 4810), row(12, 4820), row(16, 4830)]);

		assert.deepEqual(correctionsFromResult(rows, FEED, END), []);
	});

	it('finds a time penalty applied after the feed ended', () => {
		const rows = parse([row(1, 4800), row(63, 4815), row(12, 4820), row(16, 4830)]);

		assert.deepEqual(summary(correctionsFromResult(rows, FEED, END)), [['63', 'time_penalty', 5]]);
	});

	it('finds a penalty the feed applied and the stewards withdrew, as negative seconds', () => {
		const rows = parse([row(1, 4800), row(63, 4810), row(12, 4815), row(16, 4830)]);

		assert.deepEqual(summary(correctionsFromResult(rows, FEED, END)), [['12', 'time_penalty', -5]]);
	});

	it('finds a penalty on the winner, which moves every gap, as his own', () => {
		const rows = parse([row(1, 4815), row(63, 4810), row(12, 4820), row(16, 4830)]);

		assert.deepEqual(summary(correctionsFromResult(rows, FEED, END)), [['1', 'time_penalty', 15]]);
	});

	it('ignores a car without an official time, on another lap, or off by a fraction of a second', () => {
		const rows = parse([
			row(1, 4800),
			row(63, null, { laps: 49 }),
			row(12, 4820.5),
			row(16, 4830, { laps: 49 })
		]);

		assert.deepEqual(correctionsFromResult(rows, FEED, END), []);
	});

	it('rejects a response that is not a session result', () => {
		assert.throws(() => parseSessionResult('{"detail":"No results found."}'));
	});

	it('reads qualifying, where the duration is a list of lap times', () => {
		const rows = parse([{ ...row(1, null), duration: [70.1, 69.9, null] }]);

		assert.deepEqual(correctionsFromResult(rows, [], END), []);
	});
});

function file(corrections: unknown[], key = 9858): string {
	return JSON.stringify({ key, corrections });
}

describe('parseManualCorrections', () => {
	const entry = {
		driverNumber: '4',
		kind: 'disqualified',
		reason: 'Technical non-conformity',
		at: '2025-11-23T12:00:00Z',
		source: 'https://example.com/decision.pdf'
	};

	it('maps an entry to a classification correction event', () => {
		assert.deepEqual(parseManualCorrections(file([entry]), 9858), [
			correction('4', 'disqualified', 'Technical non-conformity', '2025-11-23T12:00:00.000Z')
		]);
	});

	it('carries the seconds of a time penalty', () => {
		const [event] = parseManualCorrections(
			file([{ ...entry, driverNumber: '12', kind: 'time_penalty', seconds: 5 }]),
			9858
		);

		assert.deepEqual(event?.correction, {
			driverNumber: '12',
			kind: 'time_penalty',
			seconds: 5,
			reason: 'Technical non-conformity'
		});
	});

	it('rejects a time penalty without seconds, an entry without a source and another session', () => {
		assert.throws(
			() => parseManualCorrections(file([{ ...entry, kind: 'time_penalty' }]), 9858),
			/seconds/
		);
		assert.throws(() => parseManualCorrections(file([{ ...entry, source: undefined }]), 9858));
		assert.throws(() => parseManualCorrections(file([entry], 9000), 9858), /expected 9858/);
	});
});

describe('ManualCorrections', () => {
	it('has none for a session without a file', async () => {
		const directory = mkdtempSync(path.join(tmpdir(), 'manual-'));

		roots.push(directory);

		assert.deepEqual(await new ManualCorrections(directory).load(target(1)), []);
	});

	it('reads the file named after the key', async () => {
		const directory = mkdtempSync(path.join(tmpdir(), 'manual-'));

		roots.push(directory);
		writeFileSync(
			path.join(directory, '5.json'),
			JSON.stringify({
				key: 5,
				corrections: [
					{
						driverNumber: '1',
						kind: 'disqualified',
						reason: 'r',
						at: '2025-01-01T00:00:00Z',
						source: 'https://example.com'
					}
				]
			})
		);

		const events = await new ManualCorrections(directory).load(target(5));

		assert.equal(events.length, 1);
	});

	it('ships a file for the 2025 Las Vegas race that matches its format', async () => {
		const events = await new ManualCorrections().load(target(9858));

		assert.deepEqual(
			events.map((event) => [event.correction.driverNumber, event.correction.kind]),
			[
				['4', 'disqualified'],
				['81', 'disqualified']
			]
		);
	});
});

describe('mergeCorrections', () => {
	it('lets a later source replace an earlier one for the same driver and kind', () => {
		const merged = mergeCorrections([
			[
				correction('4', 'disqualified', 'from OpenF1'),
				correction('81', 'disqualified', 'from OpenF1')
			],
			[correction('4', 'disqualified', 'from the file', '2025-11-23T12:00:00.000Z')]
		]);

		assert.deepEqual(
			merged.map((event) => [event.correction.driverNumber, event.correction.reason]),
			[
				['81', 'from OpenF1'],
				['4', 'from the file']
			]
		);
	});

	it('keeps corrections of different kinds for one driver', () => {
		const merged = mergeCorrections([
			[correction('12', 'time_penalty', 'late penalty')],
			[correction('12', 'disqualified', 'later decision', '2025-11-24T00:00:00.000Z')]
		]);

		assert.equal(merged.length, 2);
	});

	it('orders by time, then driver and kind, whatever the order of the sources', () => {
		const a = correction('81', 'disqualified', 'a');
		const b = correction('4', 'disqualified', 'b');

		assert.deepEqual(mergeCorrections([[a, b]]), mergeCorrections([[b, a]]));
		assert.equal(mergeCorrections([[a, b]])[0]?.correction.driverNumber, '4');
	});

	it('is empty without corrections', () => {
		assert.deepEqual(mergeCorrections([[], []]), []);
	});
});
