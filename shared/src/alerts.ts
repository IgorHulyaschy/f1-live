import type { Driver, RaceSnapshot, SessionStatus, TrackStatus } from './race.ts';
import { resultsHidden, type SpoilerSettings } from './viewer.ts';

export * from './alert-settings.ts';

/**
 * Alerts for the driver a viewer follows, and for the session around them. One pure rule set
 * serves the browser (toasts, from the snapshot it shows) and the server (Web Push, from the
 * live session): `diffAlerts` compares the session before and after some events.
 */

export const ALERT_KINDS = ['pit_stop', 'flag', 'penalty', 'retirement', 'session_start'] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

/** What an alert says, in the words of the notice. */
export const ALERT_LABELS: Record<AlertKind, { name: string; detail: string }> = {
	pit_stop: { name: 'Pit stop', detail: 'Your driver comes into the pits' },
	flag: {
		name: 'Flags',
		detail: 'Yellow, red, safety car and virtual safety car, and when it ends'
	},
	penalty: { name: 'Penalty', detail: 'The stewards penalise your driver' },
	retirement: { name: 'Retirement', detail: 'Your driver is out' },
	session_start: { name: 'Session start', detail: 'The session, or a part of qualifying, begins' }
};

export type Alert = {
	kind: AlertKind;
	/** The same fact always has the same id, so a device that hears it twice shows it once. */
	id: string;
	sessionId: string;
	lap: number;
	/** The racing number it is about; null for what concerns everyone on track. */
	driverNumber: string | null;
	title: string;
	body: string;
};

const driverCode = (drivers: readonly Driver[], number: string): string =>
	drivers.find((driver) => driver.number === number)?.code ?? `#${number}`;

const FLAG_TITLES: Record<Exclude<TrackStatus, 'green'>, string> = {
	yellow: 'Yellow flag',
	vsc: 'Virtual safety car',
	safety_car: 'Safety car',
	red: 'Red flag'
};

/** Neutralised or stopped: when it ends, the green flag is news. */
const STOPPED: ReadonlySet<TrackStatus> = new Set(['red', 'safety_car', 'vsc']);

const KNOCKOUT_PREFIX = { qualifying: 'Q', sprint_qualifying: 'SQ' } as const;

function sessionTitle(after: RaceSnapshot): string {
	const { session } = after;

	const prefix =
		session.type === 'qualifying' || session.type === 'sprint_qualifying'
			? KNOCKOUT_PREFIX[session.type]
			: null;

	const parts = (after.statusLog ?? []).filter((change) => change.status === 'started').length;
	const name = session.name ?? session.type.replaceAll('_', ' ');

	return prefix && parts > 0
		? `${name}: ${prefix}${Math.min(parts, 3)} has started`
		: `${name} has started`;
}

/** Went from not running to running; a red flag's restart is not a new start. */
function started(before: SessionStatus | undefined, after: SessionStatus | undefined): boolean {
	return (
		after === 'started' && (before === undefined || before === 'inactive' || before === 'finished')
	);
}

/**
 * The alerts that came about between two states of the same session; none when `before` is the
 * first the caller has seen or another session, since then there is nothing to compare. Only
 * what is new counts: a state that already held a retirement does not announce it again.
 */
export function diffAlerts(before: RaceSnapshot | null, after: RaceSnapshot): Alert[] {
	if (!before || before.session.id !== after.session.id) {
		return [];
	}

	const sessionId = after.session.id;
	const alerts: Alert[] = [];
	const lap = after.currentLap;
	const { drivers } = after;

	if (started(before.status, after.status)) {
		alerts.push({
			kind: 'session_start',
			id: `start:${sessionId}:${(after.statusLog ?? []).length}`,
			sessionId,
			lap,
			driverNumber: null,
			title: sessionTitle(after),
			body: after.session.meetingName
		});
	}

	const flags = (after.trackStatusLog ?? []).slice((before.trackStatusLog ?? []).length);
	let previous = before.trackStatus;

	for (const change of flags.length > 0 ? flags : trackChange(before, after)) {
		if (change.status !== previous) {
			if (change.status !== 'green') {
				alerts.push({
					kind: 'flag',
					id: `flag:${sessionId}:${change.at}:${change.status}`,
					sessionId,
					lap,
					driverNumber: null,
					title: FLAG_TITLES[change.status],
					body: `Lap ${lap}`
				});
			} else if (STOPPED.has(previous) || previous === 'yellow') {
				alerts.push({
					kind: 'flag',
					id: `flag:${sessionId}:${change.at}:green`,
					sessionId,
					lap,
					driverNumber: null,
					title: STOPPED.has(previous) ? 'Green flag: racing resumes' : 'Track clear',
					body: `Lap ${lap}`
				});
			}

			previous = change.status;
		}
	}

	for (const penalty of (after.penalties ?? []).slice((before.penalties ?? []).length)) {
		if (penalty.status === 'issued') {
			const amount = penalty.seconds ? `${penalty.seconds} s ` : '';
			const what = penalty.kind.replaceAll('_', ' ');

			alerts.push({
				kind: 'penalty',
				id: `penalty:${sessionId}:${penalty.driverNumber}:${penalty.lap}:${penalty.kind}`,
				sessionId,
				lap: penalty.lap,
				driverNumber: penalty.driverNumber,
				title: `${driverCode(drivers, penalty.driverNumber)}: ${amount}${what} penalty`,
				body: penalty.reason
			});
		}
	}

	for (const retirement of after.retirements.slice(before.retirements.length)) {
		alerts.push({
			kind: 'retirement',
			id: `retire:${sessionId}:${retirement.driverNumber}`,
			sessionId,
			lap: retirement.lap,
			driverNumber: retirement.driverNumber,
			title: `${driverCode(drivers, retirement.driverNumber)} is out`,
			body: retirement.reason
		});
	}

	const wasInPit = new Set(
		(before.standings ?? [])
			.filter((standing) => standing.inPit)
			.map((standing) => standing.driverNumber)
	);

	const knew = new Set((before.standings ?? []).map((standing) => standing.driverNumber));

	for (const standing of after.standings ?? []) {
		if (standing.inPit && knew.has(standing.driverNumber) && !wasInPit.has(standing.driverNumber)) {
			const stop =
				after.pitStops.filter((entry) => entry.driverNumber === standing.driverNumber).length + 1;

			alerts.push({
				kind: 'pit_stop',
				id: `pit:${sessionId}:${standing.driverNumber}:${standing.lapsCompleted}`,
				sessionId,
				lap: standing.lapsCompleted + 1,
				driverNumber: standing.driverNumber,
				title: `${driverCode(drivers, standing.driverNumber)} is in the pits`,
				body: `Stop ${stop}, lap ${standing.lapsCompleted + 1}`
			});
		}
	}

	return alerts;
}

/** A track status that changed without a log entry (the modelled replay has no log). */
function trackChange(
	before: RaceSnapshot,
	after: RaceSnapshot
): { at: string; status: TrackStatus }[] {
	return before.trackStatus === after.trackStatus
		? []
		: [{ at: `lap-${after.currentLap}`, status: after.trackStatus }];
}

/** An alert about a driver is for whoever follows them; one about the track is for everyone. */
export function isForDriver(alert: Alert, followed: string | null): boolean {
	return alert.driverNumber === null || alert.driverNumber === followed;
}

/** Alerts that give a finished session's result away: who retired, who was penalised. */
const RESULT_REVEALING: ReadonlySet<AlertKind> = new Set(['retirement', 'penalty']);

/** Finalised or ended: the classification stands, and what follows is about the result. */
function sessionOver(status: SessionStatus | undefined): boolean {
	return status === 'finalised' || status === 'ended';
}

/**
 * Whether a push must be held back to keep a result from the viewer. While a session runs
 * everything it does is live and welcome; once it is over, a viewer who has protection on and
 * has not revealed it hears nothing that gives the result away (`resultsHidden`, the one
 * spoiler rule). No settings on the account means a first visit's default: protection on.
 */
export function spoilsResult(
	alert: Pick<Alert, 'kind' | 'sessionId'>,
	status: SessionStatus | undefined,
	viewer: SpoilerSettings | null
): boolean {
	return (
		RESULT_REVEALING.has(alert.kind) &&
		resultsHidden(viewer ?? { protect: true, revealed: [] }, alert.sessionId, !sessionOver(status))
	);
}
