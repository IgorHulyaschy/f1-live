import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { ClassificationCorrectionEvent } from '@f1-live/shared';

import { ManualCorrections, parseManualCorrections } from '../sources/manual/corrections.js';
import { correctionsFromResult, parseSessionResult } from '../sources/openf1/session-result.js';
import { mergeCorrections } from './corrections.js';

const roots: string[] = [];

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

function correction(
	driverNumber: string,
	kind: 'disqualified' | 'time_penalty',
	reason: string,
	at = '2025-11-23T06:00:00.000Z'
): ClassificationCorrectionEvent {
	return { kind: 'classification_correction', at, correction: { driverNumber, kind, reason } };
}

describe('correctionsFromResult', () => {
	it('turns each disqualified row of an OpenF1 session result into a correction at the end of the session', () => {
		const rows = parseSessionResult(
			JSON.stringify([
				{ session_key: 9858, driver_number: 81, dsq: true, position: null, points: 0 },
				{ session_key: 9858, driver_number: 1, dsq: false, position: 1, points: 25 },
				{ session_key: 9858, driver_number: 4, dsq: true, position: null, points: 0 }
			])
		);

		assert.deepEqual(
			correctionsFromResult(rows, '2025-11-23T05:30:00.000Z').map((event) => [
				event.at,
				event.correction.driverNumber,
				event.correction.kind
			]),
			[
				['2025-11-23T05:30:00.000Z', '4', 'disqualified'],
				['2025-11-23T05:30:00.000Z', '81', 'disqualified']
			]
		);
	});

	it('rejects a response that is not a session result', () => {
		assert.throws(() => parseSessionResult('{"detail":"No results found."}'));
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

		assert.deepEqual(await new ManualCorrections(directory).load({ key: 1, endedAt: '' }), []);
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

		const events = await new ManualCorrections(directory).load({ key: 5, endedAt: '' });

		assert.equal(events.length, 1);
	});

	it('ships a file for the 2025 Las Vegas race that matches its format', async () => {
		const events = await new ManualCorrections().load({ key: 9858, endedAt: '' });

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
