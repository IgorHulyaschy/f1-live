import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { describeShortfall, freeBytes, hasRoom, sizeOnDisk } from './disk.js';

const GB = 1e9;

describe('hasRoom', () => {
	it('allows a download that leaves the floor free, and refuses one that does not', () => {
		assert.equal(hasRoom({ freeBytes: 21 * GB, floorBytes: 10 * GB }, 11 * GB), true);
		assert.equal(hasRoom({ freeBytes: 21 * GB, floorBytes: 10 * GB }, 11 * GB + 1), false);
		assert.equal(hasRoom({ freeBytes: 9.5 * GB, floorBytes: 10 * GB }, 0), false);
	});

	it('says how far below the floor a download would go', () => {
		assert.equal(
			describeShortfall({ freeBytes: 10.4 * GB, floorBytes: 10 * GB }, 0.6 * GB),
			'10.4 GB free and 0.6 GB needed, below the 10 GB floor'
		);
		assert.equal(
			describeShortfall({ freeBytes: 9.2 * GB, floorBytes: 10 * GB }, 0),
			'9.2 GB free, below the 10 GB floor'
		);
	});
});

describe('the disk', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'disk-'));

	after(() => rmSync(root, { recursive: true, force: true }));

	it('measures a folder by the blocks its files take, nothing when absent', async () => {
		mkdirSync(path.join(root, 'a/b'), { recursive: true });
		writeFileSync(path.join(root, 'a/one'), Buffer.alloc(10_000));
		writeFileSync(path.join(root, 'a/b/two'), Buffer.alloc(5000));

		const size = await sizeOnDisk(path.join(root, 'a'));

		assert.ok(size >= 15_000, `${size} bytes`);
		assert.ok(size < 100_000, `${size} bytes`);
		assert.equal(await sizeOnDisk(path.join(root, 'missing')), 0);
	});

	it('reads the free space of a folder that does not exist yet', async () => {
		assert.ok((await freeBytes(path.join(root, 'new/folder'))) > 0);
	});
});
