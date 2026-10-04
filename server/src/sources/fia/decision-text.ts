import type { DecisionOutcome, DecisionPenalty, DecisionSession } from '@f1-live/shared/decisions';

/**
 * What one stewards' document says, read from the text of its PDF. Every document of the
 * 2019-2026 seasons prints the same labelled block ("No / Driver", "Session", "Fact", "Decision"),
 * with small changes of wording ("Offence" became "Infringement" in 2023), so the reader looks for
 * the labels and not for a position.
 */
export interface ParsedDecision {
	document: number | null;
	car: string | null;
	driverName: string | null;
	team: string | null;
	time: string | null;
	session: DecisionSession | null;
	fact: string | null;
	infringement: string | null;
	decision: string | null;
	outcome: DecisionOutcome;
	penalties: DecisionPenalty[];
}

const BODY_LABELS = [
	'No / Driver',
	'Competitor',
	'Time',
	'Session',
	'Fact',
	'Offence',
	'Infringement',
	'Decision',
	'Reason',
	'Note'
] as const;

type Label = (typeof BODY_LABELS)[number];

const LABEL_LINE = new RegExp(
	`^(${BODY_LABELS.join('|').replaceAll('/', String.raw`\/`)})(?::|\\s)\\s*(.*)$`
);

/** The labelled lines after the heading; a value carries on until the next label. */
function readFields(text: string): Map<Label, string> {
	const lines = text.split('\n').map((line) => line.trim());
	const start = lines.findIndex((line) => /^(No \/ Driver|Competitor|Session|Fact)\b/.test(line));
	const fields = new Map<Label, string>();

	if (start === -1) {
		return fields;
	}

	let current: Label | null = null;

	for (const line of lines.slice(start)) {
		const match = LABEL_LINE.exec(line);
		const label = BODY_LABELS.find((candidate) => candidate === match?.[1]);

		if (label !== undefined && !fields.has(label)) {
			current = label;
			fields.set(label, match?.[2] ?? '');
		} else if (current !== null && line !== '') {
			fields.set(current, `${fields.get(current) ?? ''} ${line}`.trim());
		}

		if (current === 'Reason' || current === 'Note') {
			break;
		}
	}

	return fields;
}

export function sessionOf(name: string): DecisionSession | null {
	if (/sprint\s+(qualifying|shootout)/i.test(name)) {
		return 'sprint_qualifying';
	}

	if (/sprint/i.test(name)) {
		return 'sprint';
	}

	if (/qualifying/i.test(name)) {
		return 'qualifying';
	}

	if (/practice/i.test(name)) {
		return 'practice';
	}

	if (/^race\b/i.test(name)) {
		return 'race';
	}

	return null;
}

/** The penalties a decision's wording imposes, in the order they are named. */
export function penaltiesOf(decision: string): DecisionPenalty[] {
	const penalties: DecisionPenalty[] = [];
	const time = /(\d+)[\s-]*(?:second|sec)s?\s+time\s+penalty/i.exec(decision);
	const grid = /(?:drop|dropped)\s+of\s+(\d+)\s+grid/i.exec(decision);
	const stopGo = /stop[\s-]*(?:and|\/)?[\s-]*go/i.test(decision);
	const fine = /€\s*([\d,.]+)/.exec(decision);
	const points = /(\d+)\s+penalty\s+points?/i.exec(decision);

	if (time?.[1] !== undefined) {
		penalties.push({ kind: 'time', seconds: Number(time[1]) });
	}

	if (grid?.[1] !== undefined) {
		penalties.push({ kind: 'grid', places: Number(grid[1]) });
	}

	if (/drive[\s-]*through/i.test(decision)) {
		penalties.push({ kind: 'drive_through' });
	}

	if (stopGo) {
		const seconds = /(\d+)\s*(?:second|sec)/i.exec(decision)?.[1];

		const penalty: DecisionPenalty = { kind: 'stop_go' };

		if (seconds !== undefined) {
			penalty.seconds = Number(seconds);
		}

		penalties.push(penalty);
	}

	if (/reprimand/i.test(decision)) {
		penalties.push({ kind: 'reprimand' });
	}

	if (/disqualif/i.test(decision)) {
		penalties.push({ kind: 'disqualification' });
	}

	if (fine?.[1] !== undefined) {
		penalties.push({
			kind: 'fine',
			amount: Number(fine[1].replaceAll(/[,.]$/g, '').replaceAll(',', ''))
		});
	}

	if (points?.[1] !== undefined) {
		penalties.push({ kind: 'penalty_points', amount: Number(points[1]) });
	}

	if (
		/back of the (?:starting )?grid|start the (?:race|sprint) from (?:the )?pit[\s-]*lane/i.test(
			decision
		) ||
		(penalties.length === 0 && /deletion of|warning/i.test(decision))
	) {
		penalties.push({ kind: 'other' });
	}

	return penalties;
}

function outcomeOf(
	decision: string | null,
	summons: boolean,
	penalties: DecisionPenalty[]
): DecisionOutcome {
	if (penalties.length > 0) {
		return 'penalty';
	}

	if (decision !== null && /no further action/i.test(decision)) {
		return 'no_action';
	}

	return summons ? 'investigation' : 'unreadable';
}

/**
 * Reads the text of one decision. `summons` is true when the title says the document only calls
 * the driver to the stewards. A document without the labelled block gives `unreadable`.
 */
export function parseDecisionText(text: string, summons: boolean): ParsedDecision {
	const fields = readFields(text);
	const driver = /^(\d+)\s*[-–]\s*(.+)$/.exec(fields.get('No / Driver') ?? '');
	const decision = fields.get('Decision') ?? null;
	const penalties = decision === null ? [] : penaltiesOf(decision);

	return {
		document: Number(/^Document\s+(\d+)$/m.exec(text)?.[1]) || null,
		car: driver?.[1] ?? null,
		driverName: driver?.[2]?.trim() ?? null,
		team: fields.get('Competitor') ?? null,
		time: fields.get('Time') ?? null,
		session: sessionOf(fields.get('Session') ?? ''),
		fact: fields.get('Fact') ?? null,
		infringement: fields.get('Infringement') ?? fields.get('Offence') ?? null,
		decision,
		outcome: outcomeOf(decision, summons, penalties),
		penalties
	};
}
