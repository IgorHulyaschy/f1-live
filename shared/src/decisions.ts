import { z } from 'zod';

/**
 * The stewards' decisions: one file per season (`out/decisions/<season>.json`), built from the
 * FIA's published documents. Only the fields below and the document's address are kept; the PDFs
 * stay with the FIA.
 */

/** What a decision imposed. A reprimand and a disqualification carry no number. */
export const DECISION_PENALTY_KINDS = [
	'time',
	'grid',
	'drive_through',
	'stop_go',
	'reprimand',
	'disqualification',
	'fine',
	'penalty_points',
	'other'
] as const;

export type DecisionPenaltyKind = (typeof DECISION_PENALTY_KINDS)[number];

const penaltySchema = z.object({
	kind: z.enum(DECISION_PENALTY_KINDS),
	/** A time penalty or a stop-go, in seconds. */
	seconds: z.number().optional(),
	/** A grid penalty, in places. */
	places: z.number().optional(),
	/** A fine, in euros; penalty points, as a count. */
	amount: z.number().optional()
});

export type DecisionPenalty = z.infer<typeof penaltySchema>;

/**
 * What the document says happened: a `penalty` was given, `no_action` ends the matter, an
 * `investigation` is a summons or a note that the incident is under review, and `unreadable`
 * keeps a document whose text could not be read, with its title and address.
 */
export const DECISION_OUTCOMES = ['penalty', 'no_action', 'investigation', 'unreadable'] as const;

export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/** The session a decision is about, as the document names it. */
export const DECISION_SESSIONS = [
	'practice',
	'sprint_qualifying',
	'sprint',
	'qualifying',
	'race'
] as const;

export type DecisionSession = (typeof DECISION_SESSIONS)[number];

export const decisionSchema = z.object({
	/** Stable across rebuilds: the season, the FIA event and the document number. */
	id: z.string(),
	season: z.int(),
	/** The FIA's name for the event, e.g. "Las Vegas Grand Prix". */
	event: z.string(),
	/** The meeting and the round it matched in the results index; null when none did. */
	meetingKey: z.int().nullable(),
	round: z.int().nullable(),
	/** The key of the session's results the decision belongs to; null when there is none. */
	sessionKey: z.int().nullable(),
	session: z.enum(DECISION_SESSIONS).nullable(),
	document: z.int().nullable(),
	title: z.string(),
	/** The FIA's address of the PDF. */
	url: z.url(),
	/** ISO 8601, UTC. */
	publishedAt: z.string(),
	outcome: z.enum(DECISION_OUTCOMES),
	car: z.string().nullable(),
	/** A driver id from `driverIdOf`; null when the document names none we could match. */
	driver: z.string().nullable(),
	driverName: z.string().nullable(),
	team: z.string().nullable(),
	/** When it happened, as the document prints it ("20:04"), or a lap. */
	time: z.string().nullable(),
	/** What happened, in the stewards' words. */
	fact: z.string().nullable(),
	/** The rule broken, in the stewards' words. */
	infringement: z.string().nullable(),
	/** The stewards' decision text. */
	decision: z.string().nullable(),
	penalties: z.array(penaltySchema)
});

export type Decision = z.infer<typeof decisionSchema>;

export const seasonDecisionsSchema = z.object({
	season: z.int(),
	decisions: z.array(decisionSchema)
});

export type SeasonDecisions = z.infer<typeof seasonDecisionsSchema>;

/** "5 s time penalty", "5-place grid penalty", "reprimand": the short form of one penalty. */
export function describePenalty(penalty: DecisionPenalty): string {
	switch (penalty.kind) {
		case 'time':
			return `${penalty.seconds ?? '?'} s time penalty`;
		case 'grid':
			return `${penalty.places ?? '?'}-place grid penalty`;
		case 'drive_through':
			return 'drive-through penalty';
		case 'stop_go':
			return `${penalty.seconds ?? '10'} s stop-and-go penalty`;
		case 'reprimand':
			return 'reprimand';
		case 'disqualification':
			return 'disqualification';
		case 'fine':
			return `€${penalty.amount?.toLocaleString('en') ?? '?'} fine`;
		case 'penalty_points':
			return `${penalty.amount ?? '?'} penalty ${penalty.amount === 1 ? 'point' : 'points'}`;
		case 'other':
			return 'other penalty';
	}
}

/** Every penalty of a decision in one line; the outcome's name when there is none. */
export function describeDecision(decision: Pick<Decision, 'outcome' | 'penalties'>): string {
	if (decision.penalties.length > 0) {
		return decision.penalties.map(describePenalty).join(', ');
	}

	return {
		penalty: 'penalty',
		no_action: 'no further action',
		investigation: 'under investigation',
		unreadable: 'document not read'
	}[decision.outcome];
}
