import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	ALERT_KINDS,
	type AlertSettings,
	alertSettingsSchema,
	DEFAULT_ALERT_SETTINGS,
	diffAlerts,
	inQuietHours,
	isForDriver,
	spoilsResult
} from './alerts.ts';
import { EMPTY_SNAPSHOT, applyEvent } from './apply-event.ts';
import type { RaceEvent } from './events.ts';
import type { RaceSnapshot, SessionType } from './race.ts';

const AT = '2026-10-04T07:00:00.000Z';

function session(type: SessionType = 'race', name = 'Race', id = '11731'): RaceEvent {
	return {
		kind: 'session_info',
		at: AT,
		session: {
			id,
			meetingName: 'Singapore Grand Prix',
			circuit: 'Marina Bay',
			countryCode: 'SGP',
			type,
			name,
			startsAt: AT
		}
	};
}

const driver = (number: string, code: string): RaceEvent => ({
	kind: 'driver_entry',
	at: AT,
	driver: {
		number,
		code,
		firstName: code,
		lastName: code,
		team: 'Team',
		teamColour: 'ffffff'
	}
});

const standing = (driverNumber: string, position: number): RaceEvent => ({
	kind: 'standing',
	at: AT,
	driverNumber,
	position,
	gapToLeaderMs: position === 1 ? 0 : 1000 * position,
	intervalMs: position === 1 ? 0 : 1000
});

function after(base: RaceSnapshot, ...events: RaceEvent[]): RaceSnapshot {
	return events.reduce(applyEvent, base);
}

/** A grid of VER and NOR with the session known, before anything happens. */
function grid(type: SessionType = 'race'): RaceSnapshot {
	return after(
		EMPTY_SNAPSHOT,
		session(type),
		driver('1', 'VER'),
		driver('4', 'NOR'),
		standing('1', 1),
		standing('4', 2)
	);
}

const status = (
	value: 'inactive' | 'started' | 'aborted' | 'finished' | 'finalised'
): RaceEvent => ({
	kind: 'session_status',
	at: AT,
	status: value
});

const track = (value: 'green' | 'yellow' | 'vsc' | 'safety_car' | 'red', at = AT): RaceEvent => ({
	kind: 'track_status',
	at,
	status: value
});

const titles = (before: RaceSnapshot | null, next: RaceSnapshot) =>
	diffAlerts(before, next).map((alert) => `${alert.kind}: ${alert.title}`);

describe('session start', () => {
	it('announces the session when it starts, and not again for a red flag’s restart', () => {
		const before = grid();
		const running = after(before, status('started'));

		assert.deepEqual(titles(before, running), ['session_start: Race has started']);

		const stopped = after(running, status('aborted'));

		assert.deepEqual(titles(running, stopped), []);
		assert.deepEqual(titles(stopped, after(stopped, status('started'))), []);
	});

	it('names the part of a qualifying session', () => {
		const q1 = after(grid('qualifying'), status('started'));
		const between = after(q1, status('finished'), status('inactive'));
		const q2 = after(between, status('started'));

		assert.deepEqual(titles(grid('qualifying'), q1), ['session_start: Race: Q1 has started']);
		assert.deepEqual(titles(between, q2), ['session_start: Race: Q2 has started']);
	});
});

describe('flags', () => {
	it('announces yellow, a safety car and the green flag that ends it', () => {
		const before = after(grid(), status('started'));
		const yellow = after(before, track('yellow'));
		const safetyCar = after(yellow, track('safety_car', '2026-10-04T07:10:00.000Z'));
		const green = after(safetyCar, track('green', '2026-10-04T07:15:00.000Z'));

		assert.deepEqual(titles(before, yellow), ['flag: Yellow flag']);
		assert.deepEqual(titles(yellow, safetyCar), ['flag: Safety car']);
		assert.deepEqual(titles(safetyCar, green), ['flag: Green flag: racing resumes']);
		assert.deepEqual(titles(yellow, after(yellow, track('green', '2026-10-04T07:12:00.000Z'))), [
			'flag: Track clear'
		]);
	});

	it('finds every change in a batch, so a flag that came and went is still said', () => {
		const before = after(grid(), status('started'));

		const next = after(
			before,
			track('yellow', '2026-10-04T07:10:00.000Z'),
			track('green', '2026-10-04T07:10:20.000Z')
		);

		assert.deepEqual(titles(before, next), ['flag: Yellow flag', 'flag: Track clear']);
	});

	it('is quiet when the status did not change', () => {
		const state = after(grid(), status('started'), track('red'));

		assert.deepEqual(titles(state, after(state, track('red', '2026-10-04T07:20:00.000Z'))), []);
	});
});

const penalty = (driverNumber: string, state: 'issued' | 'served' | 'revoked'): RaceEvent => ({
	kind: 'penalty',
	at: AT,
	penalty: {
		driverNumber,
		kind: 'time',
		seconds: 5,
		reason: 'Causing a collision',
		lap: 12,
		status: state
	}
});

describe('a driver’s stop, penalty and retirement', () => {
	const running = after(grid(), status('started'));

	it('says when a driver comes into the pits, with the stop number', () => {
		const alerts = diffAlerts(
			running,
			after(running, { kind: 'pit_entry', at: AT, driverNumber: '4', lap: 18 })
		);

		assert.deepEqual(
			alerts.map(({ kind, driverNumber, title, body }) => ({ kind, driverNumber, title, body })),
			[{ kind: 'pit_stop', driverNumber: '4', title: 'NOR is in the pits', body: 'Stop 1, lap 1' }]
		);
	});

	it('announces a penalty when it is issued, not when it is served or revoked', () => {
		const issued = after(running, penalty('1', 'issued'));

		assert.deepEqual(titles(running, issued), ['penalty: VER: 5 s time penalty']);
		assert.equal(diffAlerts(running, issued)[0]?.body, 'Causing a collision');
		assert.deepEqual(titles(issued, after(issued, penalty('1', 'served'))), []);
	});

	it('announces a retirement once', () => {
		const out = after(running, {
			kind: 'retirement',
			at: AT,
			driverNumber: '4',
			reason: 'Power unit'
		});

		assert.deepEqual(titles(running, out), ['retirement: NOR is out']);
		assert.deepEqual(titles(out, out), []);
		assert.equal(diffAlerts(running, out)[0]?.body, 'Power unit');
	});

	it('gives each fact one id, however many times it is worked out', () => {
		const out = after(running, {
			kind: 'retirement',
			at: AT,
			driverNumber: '4',
			reason: 'Power unit'
		});

		assert.equal(diffAlerts(running, out)[0]?.id, diffAlerts(running, out)[0]?.id);
		assert.equal(new Set(diffAlerts(running, out).map((alert) => alert.id)).size, 1);
	});
});

describe('what has nothing to compare', () => {
	it('is no alert for a first look, or when the session changed', () => {
		const running = after(grid(), status('started'), track('red'));
		const other = after(EMPTY_SNAPSHOT, session('race', 'Race', '1'));

		assert.deepEqual(diffAlerts(null, running), []);
		assert.deepEqual(diffAlerts(other, running), []);
	});
});

describe('who an alert is for', () => {
	const flag = { driverNumber: null };
	const pit = { driverNumber: '4' };

	it('sends the track’s news to everyone and a driver’s to the ones who follow them', () => {
		assert.equal(isForDriver({ ...diffFlag(), ...flag }, '1'), true);
		assert.equal(isForDriver({ ...diffFlag(), ...pit }, '4'), true);
		assert.equal(isForDriver({ ...diffFlag(), ...pit }, '1'), false);
		assert.equal(isForDriver({ ...diffFlag(), ...pit }, null), false);
	});
});

function diffFlag() {
	const running = after(grid(), status('started'));
	const [alert] = diffAlerts(running, after(running, track('yellow')));

	assert.ok(alert);

	return alert;
}

describe('quiet hours', () => {
	const quiet = { enabled: true, from: '23:00', to: '07:00', timeZone: 'Europe/Kyiv' };

	it('holds a window that runs past midnight, in the viewer’s own time zone', () => {
		// Kyiv is UTC+3 in October: 20:30 UTC is 23:30 there.
		assert.equal(inQuietHours(quiet, new Date('2026-10-03T20:30:00Z')), true);
		assert.equal(inQuietHours(quiet, new Date('2026-10-04T03:59:00Z')), true);
		assert.equal(inQuietHours(quiet, new Date('2026-10-04T04:00:00Z')), false);
		assert.equal(inQuietHours(quiet, new Date('2026-10-04T10:00:00Z')), false);
		assert.equal(inQuietHours(quiet, new Date('2026-10-03T19:59:00Z')), false);
	});

	it('holds a window inside one day', () => {
		const lunch = { enabled: true, from: '12:00', to: '13:30', timeZone: 'UTC' };

		assert.equal(inQuietHours(lunch, new Date('2026-10-04T12:00:00Z')), true);
		assert.equal(inQuietHours(lunch, new Date('2026-10-04T13:29:00Z')), true);
		assert.equal(inQuietHours(lunch, new Date('2026-10-04T13:30:00Z')), false);
	});

	it('is off when disabled, empty, or in a zone nobody knows', () => {
		const at = new Date('2026-10-04T00:30:00Z');

		assert.equal(inQuietHours({ ...quiet, timeZone: 'UTC', enabled: false }, at), false);
		assert.equal(
			inQuietHours({ ...quiet, timeZone: 'UTC', from: '08:00', to: '08:00' }, at),
			false
		);
		assert.equal(inQuietHours({ ...quiet, timeZone: 'Mars/Olympus' }, at), false);
	});
});

const alert = (kind: (typeof ALERT_KINDS)[number]) => ({ kind, sessionId: '11731' });

describe('spoiler protection', () => {
	const protectedViewer = { protect: true, revealed: ['9858'] };

	it('lets everything through while the session runs', () => {
		for (const kind of ALERT_KINDS) {
			assert.equal(spoilsResult(alert(kind), 'started', protectedViewer), false, kind);
		}
	});

	it('holds back a result once the session is over, for a protected viewer who has not seen it', () => {
		for (const over of ['finalised', 'ended'] as const) {
			assert.equal(spoilsResult(alert('retirement'), over, protectedViewer), true);
			assert.equal(spoilsResult(alert('penalty'), over, protectedViewer), true);
		}

		// What is not a result is still fine.
		assert.equal(spoilsResult(alert('flag'), 'finalised', protectedViewer), false);
		assert.equal(spoilsResult(alert('pit_stop'), 'finalised', protectedViewer), false);
		assert.equal(spoilsResult(alert('session_start'), 'finalised', protectedViewer), false);
	});

	it('lets a result through to a viewer who revealed the session or turned protection off', () => {
		assert.equal(
			spoilsResult(alert('penalty'), 'finalised', { protect: true, revealed: ['11731'] }),
			false
		);
		assert.equal(
			spoilsResult(alert('penalty'), 'finalised', { protect: false, revealed: [] }),
			false
		);
	});

	it('treats an account with no settings as protected, as a first visit is', () => {
		assert.equal(spoilsResult(alert('retirement'), 'finalised', null), true);
		assert.equal(spoilsResult(alert('retirement'), 'started', null), false);
	});
});

const bad = (change: Partial<AlertSettings>) =>
	alertSettingsSchema.safeParse({ ...DEFAULT_ALERT_SETTINGS, ...change }).success;

describe('settings', () => {
	it('start valid, on for every alert, with no quiet hours or delay', () => {
		assert.deepEqual(alertSettingsSchema.parse(DEFAULT_ALERT_SETTINGS), DEFAULT_ALERT_SETTINGS);
		assert.ok(ALERT_KINDS.every((kind) => DEFAULT_ALERT_SETTINGS.push[kind]));
		assert.equal(DEFAULT_ALERT_SETTINGS.quiet.enabled, false);
		assert.equal(DEFAULT_ALERT_SETTINGS.delaySeconds, 0);
	});

	it('refuse a bad time, driver or delay', () => {
		assert.equal(bad({ quiet: { ...DEFAULT_ALERT_SETTINGS.quiet, from: '25:00' } }), false);
		assert.equal(bad({ driver: 'VER' }), false);
		assert.equal(bad({ delaySeconds: 301 }), false);
		assert.equal(bad({ driver: '44', delaySeconds: 30 }), true);
	});
});
