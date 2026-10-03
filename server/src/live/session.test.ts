import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, applyEvent } from '@f1-live/shared';
import type { RaceEvent } from '@f1-live/shared';

import { LiveReplica } from './replica.js';
import { LiveSession } from './session.js';
import type { SessionUpdate } from './session.js';

const AT = '2025-11-22T06:00:00.000Z';

function sessionInfo(id: string): RaceEvent {
	return {
		kind: 'session_info',
		at: AT,
		session: {
			id,
			meetingName: 'Las Vegas Grand Prix',
			circuit: 'Las Vegas',
			countryCode: 'USA',
			type: 'race',
			startsAt: AT
		}
	};
}

function distance(totalLaps: number): RaceEvent {
	return { kind: 'race_distance', at: AT, totalLaps };
}

describe('LiveSession', () => {
	it('numbers events from one and keeps the snapshot in step with the reducer', () => {
		const session = new LiveSession(100);
		const events = [sessionInfo('1'), distance(50), distance(51)];

		session.push(events);

		assert.equal(session.position.seq, 3);
		assert.equal(session.sessionId, '1');
		assert.deepEqual(session.current, events.reduce(applyEvent, EMPTY_SNAPSHOT));
	});

	it('tells listeners which numbers a batch holds', () => {
		const session = new LiveSession(100);
		const updates: SessionUpdate[] = [];

		session.subscribe((update) => updates.push(update));
		session.push([sessionInfo('1')]);
		session.push([distance(50), distance(51)]);

		assert.deepEqual(
			updates.map((update) => update.kind === 'events' && [update.from, update.events.length]),
			[
				[1, 1],
				[2, 2]
			]
		);
	});

	it('starts a new epoch when another session begins, even inside one batch', () => {
		const session = new LiveSession(100);
		const updates: SessionUpdate[] = [];

		session.push([sessionInfo('1'), distance(50)]);

		const first = session.position;

		session.subscribe((update) => updates.push(update));
		session.push([distance(51), sessionInfo('2'), distance(60)]);

		assert.notEqual(session.position.epoch, first.epoch);
		assert.equal(session.position.seq, 2);
		assert.equal(session.sessionId, '2');
		assert.equal(session.current.session.totalLaps, 60);
		assert.deepEqual(
			updates.map((update) => update.kind),
			['events', 'state', 'events']
		);
	});

	it('resumes a viewer from the kept events and refuses what it cannot give', () => {
		const session = new LiveSession(10);
		const events = [sessionInfo('1'), ...Array.from({ length: 29 }, (_, lap) => distance(lap + 1))];

		session.push(events);

		const { epoch } = session.position;

		assert.deepEqual(session.resume(epoch, 30)?.events, []);
		assert.deepEqual(session.resume(epoch, 27)?.events, events.slice(27));
		assert.equal(session.resume(epoch, 27)?.from, 28);
		// 30 events pushed, a log of 10 trimmed in steps: 12 at most are gone.
		assert.equal(session.resume(epoch, 3), null);
		assert.equal(session.resume(epoch, 31), null);
		assert.equal(session.resume('another-epoch', 27), null);
	});

	it('copies the ingest: adopts its state, then takes only the events it lacks', () => {
		const ingest = new LiveSession(100);
		const relay = new LiveSession(100);
		const events = [sessionInfo('1'), distance(50), distance(51), distance(52)];

		ingest.push(events.slice(0, 2));
		relay.adopt(ingest.state());
		assert.deepEqual(relay.position, ingest.position);

		ingest.push(events.slice(2));

		const { epoch } = ingest.position;

		assert.deepEqual(relay.replicate(epoch, 3, events.slice(2)), { applied: true });
		assert.deepEqual(relay.replicate(epoch, 2, events.slice(1)), { applied: true });
		assert.deepEqual(relay.current, ingest.current);
		assert.deepEqual(relay.replicate(epoch, 9, events), {
			applied: false,
			position: relay.position
		});
	});
});

describe('LiveReplica', () => {
	it('follows state and events, and skips events a state already holds', () => {
		const session = new LiveSession(100);
		const replica = new LiveReplica();
		const events = [sessionInfo('1'), distance(50), distance(51)];

		session.push(events.slice(0, 2));
		assert.equal(replica.apply(session.state()), 'ok');

		const overlap = session.resume(session.position.epoch, 0);

		session.push(events.slice(2));

		const next = session.resume(session.position.epoch, 0);

		assert.ok(overlap && next);
		assert.equal(replica.apply(next), 'ok');
		assert.equal(replica.seq, 3);
		assert.deepEqual(replica.snapshot, session.current);
	});

	it('asks for a resync on a gap or an unknown epoch', () => {
		const session = new LiveSession(100);
		const replica = new LiveReplica();

		session.push([sessionInfo('1'), distance(50), distance(51)]);
		replica.apply(session.state());
		session.push([distance(52), distance(53)]);

		const gap = { ...session.resume(session.position.epoch, 3), from: 5 };

		assert.equal(
			replica.apply({
				...gap,
				v: 1,
				type: 'events',
				epoch: replica.epoch ?? '',
				at: 0,
				events: [distance(1)]
			}),
			'resync'
		);
		assert.equal(
			replica.apply({ v: 1, type: 'events', epoch: 'other', from: 1, at: 0, events: [] }),
			'resync'
		);
	});
});
