import assert from 'node:assert/strict';
import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { findSavedSession, loadReplayFrames } from './replay.js';
import { FIXTURE_DIR, tempDir } from './test-harness.js';

describe('findSavedSession', () => {
	it('finds a session by its key under year/meeting/session folders', async () => {
		const root = tempDir();
		const session = path.join(root, '2025', 'Las_Vegas', 'Race');

		mkdirSync(path.join(root, '2025', 'Las_Vegas', 'Practice'), { recursive: true });
		cpSync(FIXTURE_DIR, session, { recursive: true });

		assert.equal(await findSavedSession(root, 9858), session);
		assert.equal(await findSavedSession(root, 1), null);
		assert.equal(await findSavedSession(path.join(root, 'missing'), 9858), null);
	});
});

describe('loadReplayFrames', () => {
	it('reads every topic in time order, or only the ones asked for', async () => {
		const all = await loadReplayFrames(FIXTURE_DIR);
		const some = await loadReplayFrames(FIXTURE_DIR, ['LapCount']);

		assert.ok(all.some((frame) => frame.topic === 'CarData.z'));
		assert.deepEqual([...new Set(some.map((frame) => frame.topic))], ['LapCount']);
		assert.deepEqual(
			all.map((frame) => frame.timestamp),
			all.map((frame) => frame.timestamp).toSorted((a, b) => a - b)
		);
	});
});
