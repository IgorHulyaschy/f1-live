import { editDistance, typoAllowance } from './ask-match.ts';

/**
 * Ask: a question typed into the palette becomes a typed `Query`, which the client answers from
 * the results index and the saved sessions. The parser is pure and knows the names it can match
 * only from the `AskContext` it is given, so the client feeds it the drivers, teams and grands
 * prix of the seasons it has. A language-model resolver can later stand in for it behind the same
 * `Resolver` signature.
 */

export const ASK_SESSIONS = [
	'race',
	'qualifying',
	'sprint',
	'sprint_qualifying',
	'practice_1',
	'practice_2',
	'practice_3'
] as const;

export type AskSession = (typeof ASK_SESSIONS)[number];

/** What a driver's or team's record counts; `summary` is wins, poles, podiums and points together. */
export const ASK_STATS = [
	'wins',
	'poles',
	'podiums',
	'points',
	'dnfs',
	'fastest_laps',
	'starts',
	'laps_led',
	'q3',
	'summary'
] as const;

export type AskStat = (typeof ASK_STATS)[number];

/** What one session's data answers beyond its classification. */
export const ASK_INSIGHTS = ['fastest_lap', 'top_speed', 'tyres', 'pit_stops', 'sectors'] as const;

export type AskInsight = (typeof ASK_INSIGHTS)[number];

/** Tyre compounds a pace question can name. */
export const ASK_COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as const;

export type AskCompound = (typeof ASK_COMPOUNDS)[number];

/** Which laps a pace question counts: the session, one stint of each driver, or its last laps. */
export type PaceSpan =
	{ kind: 'race' } | { kind: 'stint'; stint: number } | { kind: 'last'; laps: number };

/** What a pace question asks for: the field ranked, two drivers, a team's cars, or practice runs. */
export type PaceMode = 'ranking' | 'versus' | 'teammates' | 'long_run';

/** A driver by the id `driverIdOf` gives, or a team by its line across names. */
export type Subject = { kind: 'driver' | 'team'; id: string };

/** Seasons from and to, both included; null is every season there is data for. */
export type SeasonSpan = { from: number; to: number } | null;

/** Which session a question is about. */
export type SessionRef =
	/** The session open on screen. */
	| { kind: 'open' }
	/** The latest one of this kind that has run. */
	| { kind: 'latest'; session: AskSession }
	/** A grand prix by its event id; `season` null is its latest edition. */
	| { kind: 'event'; event: string; season: number | null; session: AskSession }
	| { kind: 'round'; season: number; round: number; session: AskSession };

export type Query =
	/** A session's classification, or where one driver or team finished in it. */
	| { kind: 'result'; session: SessionRef; subject: Subject | null }
	/** What happened to one driver in a race or sprint: the outcome, and the moments on the way. */
	| { kind: 'story'; session: SessionRef; subject: Subject }
	/** A reading of one session's data, optionally for one driver or team. */
	| { kind: 'insight'; insight: AskInsight; session: SessionRef; subject: Subject | null }
	/** The table after a round (`after` null: the latest round there is). */
	| {
			kind: 'standings';
			table: 'drivers' | 'teams';
			season: number;
			after: { round: number } | { event: string } | null;
	  }
	/** Two drivers or two teams over the seasons both took part in. */
	| {
			kind: 'h2h';
			a: Subject;
			b: Subject;
			seasons: SeasonSpan;
			teammates: boolean;
			focus: 'qualifying' | 'race' | 'sprint' | null;
	  }
	/** One driver's or team's count over seasons. */
	| { kind: 'record'; subject: Subject; stat: AskStat; seasons: SeasonSpan }
	/** Who has the most of something over seasons. */
	| { kind: 'leaders'; table: 'drivers' | 'teams'; stat: AskStat; seasons: SeasonSpan }
	/** When the next session starts: any, one kind, or at one grand prix. */
	| { kind: 'schedule'; session: AskSession | null; event: string | null }
	/** How far one driver or team is from the lead, and whether the title is still open. */
	| { kind: 'gap'; table: 'drivers' | 'teams'; subject: Subject | null; season: number }
	/** The stewards' penalties of one driver, over seasons or at one grand prix. */
	| { kind: 'penalties'; subject: Subject; seasons: SeasonSpan; event: string | null }
	/** How old a driver is, from the birth date Wikidata holds. */
	| { kind: 'age'; subject: Subject }
	/** The youngest driver to win a race over seasons. */
	| { kind: 'youngest_winner'; seasons: SeasonSpan }
	/** Who was quicker in one session, over a span and on a compound; `a` and `b` name drivers or a team. */
	| {
			kind: 'pace';
			mode: PaceMode;
			session: SessionRef;
			a: Subject | null;
			b: Subject | null;
			span: PaceSpan;
			compound: AskCompound | null;
	  };

/** A name the parser can match: a driver, a team line or a grand prix. */
export type AskEntity = {
	kind: 'driver' | 'team' | 'event';
	id: string;
	/** How a question names it back ("Verstappen", "Red Bull", "Italian GP"). */
	label: string;
	/** Phrases that name it, in any case: "max verstappen", "verstappen", "max". */
	names: readonly string[];
	/** Three-letter codes, matched only exactly: "VER". */
	codes?: readonly string[];
};

export type AskContext = {
	/** Earlier entities win when two share a name. */
	entities: readonly AskEntity[];
	/** The season "this season" means. */
	season: number;
};

/** Text to a query, or null when it is not a question it understands. */
export type Resolver = (text: string) => Query | null;

type Token = { word: string; upper: boolean };

type Keyword =
	| { kind: 'session'; session: AskSession }
	| { kind: 'stat'; stat: AskStat }
	| { kind: 'insight'; insight: AskInsight }
	| { kind: 'standings'; teams: boolean }
	| { kind: 'teams' }
	| { kind: 'result' }
	| { kind: 'story' }
	| { kind: 'did' }
	| { kind: 'win' }
	| { kind: 'pole' }
	| { kind: 'versus' }
	| { kind: 'teammates' }
	| { kind: 'latest' }
	| { kind: 'open' }
	| { kind: 'all-time' }
	| { kind: 'this-season' }
	| { kind: 'last-season' }
	| { kind: 'since' }
	| { kind: 'range-to' }
	| { kind: 'round' }
	| { kind: 'after' }
	| { kind: 'most' }
	| { kind: 'seasons' }
	| { kind: 'next' }
	| { kind: 'when' }
	| { kind: 'gap' }
	| { kind: 'penalty' }
	| { kind: 'age' }
	| { kind: 'youngest' }
	| { kind: 'pace' }
	| { kind: 'quicker' }
	| { kind: 'long-run' }
	| { kind: 'stint' }
	| { kind: 'stint-number'; stint: number }
	| { kind: 'laps' }
	| { kind: 'compound'; compound: AskCompound };

const KEYWORDS: readonly (readonly [string, Keyword])[] = [
	...(
		[
			['sprint qualifying', 'sprint_qualifying'],
			['sprint quali', 'sprint_qualifying'],
			['sprint shootout', 'sprint_qualifying'],
			['shootout', 'sprint_qualifying'],
			['qualifying', 'qualifying'],
			['quali', 'qualifying'],
			['qualy', 'qualifying'],
			['qualification', 'qualifying'],
			['sprint race', 'sprint'],
			['sprint', 'sprint'],
			['race', 'race'],
			['grand prix', 'race'],
			['gp', 'race'],
			['fp1', 'practice_1'],
			['fp2', 'practice_2'],
			['fp3', 'practice_3'],
			['practice 1', 'practice_1'],
			['practice 2', 'practice_2'],
			['practice 3', 'practice_3'],
			['free practice 1', 'practice_1'],
			['free practice 2', 'practice_2'],
			['free practice 3', 'practice_3'],
			['first practice', 'practice_1'],
			['second practice', 'practice_2'],
			['third practice', 'practice_3']
		] as const
	).map(([phrase, session]) => [phrase, { kind: 'session', session }] as const),
	...(
		[
			['wins', 'wins'],
			['victories', 'wins'],
			['victory', 'wins'],
			['race wins', 'wins'],
			['poles', 'poles'],
			['pole positions', 'poles'],
			['podiums', 'podiums'],
			['podium', 'podiums'],
			['podium finishes', 'podiums'],
			['top 3', 'podiums'],
			['top three', 'podiums'],
			['points', 'points'],
			['point', 'points'],
			['pts', 'points'],
			['scored', 'points'],
			['dnf', 'dnfs'],
			['dnfs', 'dnfs'],
			['retirements', 'dnfs'],
			['retired', 'dnfs'],
			['did not finish', 'dnfs'],
			['fastest laps', 'fastest_laps'],
			['starts', 'starts'],
			['races', 'starts'],
			['race starts', 'starts'],
			['laps led', 'laps_led'],
			['led laps', 'laps_led'],
			['laps in the lead', 'laps_led'],
			['q3', 'q3'],
			['q3 appearances', 'q3'],
			['stats', 'summary'],
			['record', 'summary'],
			['season', 'summary']
		] as const
	).map(([phrase, stat]) => [phrase, { kind: 'stat', stat }] as const),
	...(
		[
			['fastest lap', 'fastest_lap'],
			['quickest lap', 'fastest_lap'],
			['best lap', 'fastest_lap'],
			['fastest time', 'fastest_lap'],
			['top speed', 'top_speed'],
			['top speeds', 'top_speed'],
			['max speed', 'top_speed'],
			['maximum speed', 'top_speed'],
			['highest speed', 'top_speed'],
			['speed trap', 'top_speed'],
			['vmax', 'top_speed'],
			['tyres', 'tyres'],
			['tyre', 'tyres'],
			['tires', 'tyres'],
			['tire', 'tyres'],
			['tyre strategy', 'tyres'],
			['tire strategy', 'tyres'],
			['strategy', 'tyres'],
			['strategies', 'tyres'],
			['stints', 'tyres'],
			['compounds', 'tyres'],
			['pit stop', 'pit_stops'],
			['pit stops', 'pit_stops'],
			['pitstop', 'pit_stops'],
			['pitstops', 'pit_stops'],
			['fastest stop', 'pit_stops'],
			['stops', 'pit_stops'],
			['pit', 'pit_stops'],
			['sectors', 'sectors'],
			['sector', 'sectors'],
			['sector times', 'sectors'],
			['sector gaps', 'sectors'],
			['ideal lap', 'sectors'],
			['theoretical best', 'sectors']
		] as const
	).map(([phrase, insight]) => [phrase, { kind: 'insight', insight }] as const),
	['standings', { kind: 'standings', teams: false }],
	['championship', { kind: 'standings', teams: false }],
	['champion', { kind: 'standings', teams: false }],
	['title', { kind: 'standings', teams: false }],
	['table', { kind: 'standings', teams: false }],
	['wdc', { kind: 'standings', teams: false }],
	['wcc', { kind: 'standings', teams: true }],
	['leader', { kind: 'standings', teams: false }],
	['leading', { kind: 'standings', teams: false }],
	['constructors', { kind: 'standings', teams: true }],
	['constructors championship', { kind: 'standings', teams: true }],
	['constructor', { kind: 'standings', teams: true }],
	['teams', { kind: 'teams' }],
	['result', { kind: 'result' }],
	['results', { kind: 'result' }],
	['classification', { kind: 'result' }],
	['what happened', { kind: 'story' }],
	['happened', { kind: 'story' }],
	['happend', { kind: 'story' }],
	['hapened', { kind: 'story' }],
	['hapenned', { kind: 'story' }],
	['happenned', { kind: 'story' }],
	['how did', { kind: 'story' }],
	['how was', { kind: 'story' }],
	['why did', { kind: 'story' }],
	['why was', { kind: 'story' }],
	['did', { kind: 'did' }],
	['finish', { kind: 'result' }],
	['finished', { kind: 'result' }],
	['win', { kind: 'win' }],
	['won', { kind: 'win' }],
	['winner', { kind: 'win' }],
	['pole', { kind: 'pole' }],
	['pole position', { kind: 'pole' }],
	['on pole', { kind: 'pole' }],
	['pole sitter', { kind: 'pole' }],
	['vs', { kind: 'versus' }],
	['v', { kind: 'versus' }],
	['versus', { kind: 'versus' }],
	['against', { kind: 'versus' }],
	['compared to', { kind: 'versus' }],
	['head to head', { kind: 'versus' }],
	['h2h', { kind: 'versus' }],
	['teammates', { kind: 'teammates' }],
	['teammate', { kind: 'teammates' }],
	['team mates', { kind: 'teammates' }],
	['as teammates', { kind: 'teammates' }],
	['last', { kind: 'latest' }],
	['latest', { kind: 'latest' }],
	['previous', { kind: 'latest' }],
	['most recent', { kind: 'latest' }],
	['this session', { kind: 'open' }],
	['this race', { kind: 'open' }],
	['this qualifying', { kind: 'open' }],
	['current session', { kind: 'open' }],
	['in this session', { kind: 'open' }],
	['career', { kind: 'all-time' }],
	['ever', { kind: 'all-time' }],
	['all time', { kind: 'all-time' }],
	['in history', { kind: 'all-time' }],
	['overall', { kind: 'all-time' }],
	['this season', { kind: 'this-season' }],
	['this year', { kind: 'this-season' }],
	['current season', { kind: 'this-season' }],
	['so far', { kind: 'this-season' }],
	['last season', { kind: 'last-season' }],
	['last year', { kind: 'last-season' }],
	['since', { kind: 'since' }],
	['from', { kind: 'since' }],
	['to', { kind: 'range-to' }],
	['until', { kind: 'range-to' }],
	['through', { kind: 'range-to' }],
	['round', { kind: 'round' }],
	['after', { kind: 'after' }],
	['most', { kind: 'most' }],
	['top', { kind: 'most' }],
	['seasons', { kind: 'seasons' }],
	['years', { kind: 'seasons' }],
	['next', { kind: 'next' }],
	['next session', { kind: 'next' }],
	['upcoming', { kind: 'next' }],
	['coming up', { kind: 'next' }],
	['when', { kind: 'when' }],
	['what time', { kind: 'when' }],
	['start time', { kind: 'when' }],
	['how long until', { kind: 'when' }],
	['countdown', { kind: 'when' }],
	['gap', { kind: 'gap' }],
	['behind', { kind: 'gap' }],
	['ahead', { kind: 'gap' }],
	['still', { kind: 'gap' }],
	['deficit', { kind: 'gap' }],
	['penalty', { kind: 'penalty' }],
	['penalties', { kind: 'penalty' }],
	['penalised', { kind: 'penalty' }],
	['penalized', { kind: 'penalty' }],
	['penalise', { kind: 'penalty' }],
	['penalize', { kind: 'penalty' }],
	['punished', { kind: 'penalty' }],
	['old', { kind: 'age' }],
	['age', { kind: 'age' }],
	['youngest', { kind: 'youngest' }],
	['pace', { kind: 'pace' }],
	['race pace', { kind: 'pace' }],
	['true pace', { kind: 'pace' }],
	['pace ranking', { kind: 'pace' }],
	['faster', { kind: 'quicker' }],
	['quicker', { kind: 'quicker' }],
	['slower', { kind: 'quicker' }],
	['fastest', { kind: 'quicker' }],
	['quickest', { kind: 'quicker' }],
	['long run', { kind: 'long-run' }],
	['long runs', { kind: 'long-run' }],
	['race sim', { kind: 'long-run' }],
	['stint', { kind: 'stint' }],
	['first stint', { kind: 'stint-number', stint: 1 }],
	['second stint', { kind: 'stint-number', stint: 2 }],
	['third stint', { kind: 'stint-number', stint: 3 }],
	['fourth stint', { kind: 'stint-number', stint: 4 }],
	['laps', { kind: 'laps' }],
	['team mate', { kind: 'teammates' }],
	['chance', { kind: 'gap' }],
	['chances', { kind: 'gap' }],
	['clinch', { kind: 'gap' }]
];

const COMPOUND_WORDS: readonly (readonly [AskCompound, readonly string[]])[] = [
	['SOFT', ['soft', 'softs']],
	['MEDIUM', ['medium', 'mediums']],
	['HARD', ['hard', 'hards']],
	['INTERMEDIATE', ['intermediate', 'intermediates', 'inters']],
	['WET', ['wet', 'wets', 'full wets']]
];

const KEYWORD_TABLE = new Map<string, Keyword>([
	...KEYWORDS,
	...COMPOUND_WORDS.flatMap(([compound, names]) =>
		names.map((name): [string, Keyword] => [name, { kind: 'compound', compound }])
	)
]);

const LONGEST_PHRASE = 4;

/** Codes that are also words a question uses; typed in lower case they read as the word. */
const CODES_NEEDING_CAPS = new Set(['per', 'law', 'gas', 'van', 'dev', 'had', 'lat']);

/** Words that never name anything, so no typo match turns them into a driver. */
const STOPWORDS = new Set([
	'who',
	'what',
	'which',
	'when',
	'where',
	'how',
	'many',
	'much',
	'did',
	'does',
	'do',
	'was',
	'were',
	'is',
	'are',
	'has',
	'have',
	'had',
	'the',
	'a',
	'an',
	'in',
	'at',
	'of',
	'on',
	'for',
	'and',
	'or',
	'with',
	'by',
	'get',
	'got',
	'show',
	'me',
	'his',
	'her',
	'their',
	'between',
	'there',
	'than',
	'more',
	'better',
	'beat',
	'beats',
	'compare',
	'times',
	'fastest',
	'quickest',
	'why',
	'grands',
	'prix',
	'each',
	'other'
]);

function tokenize(text: string): Token[] {
	const spaced = text
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.replaceAll(/(\d{4})\s*[-–—/]\s*(\d{4})/g, '$1 to $2')
		.replaceAll(/\b[rR](\d{1,2})\b/g, 'round $1');

	return [...spaced.matchAll(/[\p{L}\p{N}]+/gu)].map(([raw]) => ({
		word: raw.toLowerCase(),
		upper: raw.length > 1 && raw === raw.toUpperCase() && /\p{L}/u.test(raw)
	}));
}

type Piece =
	| { kind: 'keyword'; keyword: Keyword }
	| { kind: 'entity'; entity: AskEntity }
	| { kind: 'number'; value: number }
	| { kind: 'word'; word: string };

type Phrase = { text: string; entity: AskEntity };

function entityPhrases(context: AskContext): Map<string, AskEntity> {
	const table = new Map<string, AskEntity>();

	for (const entity of context.entities) {
		for (const name of entity.names) {
			const phrase = tokenize(name)
				.map((token) => token.word)
				.join(' ');

			if (phrase !== '' && !table.has(phrase)) {
				table.set(phrase, entity);
			}
		}
	}

	return table;
}

function codeTable(context: AskContext): Map<string, AskEntity> {
	const table = new Map<string, AskEntity>();

	for (const entity of context.entities) {
		for (const code of entity.codes ?? []) {
			if (!table.has(code.toLowerCase())) {
				table.set(code.toLowerCase(), entity);
			}
		}
	}

	return table;
}

/** A phrase within the typo allowance of every word, or null. */
function fuzzyPhrase(words: readonly string[], phrases: readonly Phrase[]): AskEntity | null {
	let best: { entity: AskEntity; distance: number } | null = null;

	for (const phrase of phrases) {
		const target = phrase.text.split(' ');

		if (target.length !== words.length) {
			continue;
		}

		let distance = 0;

		for (const [index, word] of words.entries()) {
			const expected = target[index] ?? '';
			const allowance = typoAllowance(Math.min(word.length, expected.length));
			const edits = word === expected ? 0 : editDistance(word, expected, allowance);

			if (edits > allowance || STOPWORDS.has(word)) {
				distance = Infinity;
				break;
			}

			distance += edits;
		}

		if (distance < (best?.distance ?? Infinity)) {
			best = { entity: phrase.entity, distance };
		}
	}

	return best?.entity ?? null;
}

/** The question as keywords, names, numbers and the words left over, longest phrase first. */
function pieces(text: string, context: AskContext): Piece[] {
	const tokens = tokenize(text);
	const entities = entityPhrases(context);
	const codes = codeTable(context);
	const fuzzy = [...entities].map(([phrase, entity]) => ({ text: phrase, entity }));
	const result: Piece[] = [];
	let index = 0;

	while (index < tokens.length) {
		let found: { piece: Piece; length: number } | null = null;

		for (let length = Math.min(LONGEST_PHRASE, tokens.length - index); length > 0; length--) {
			const span = tokens.slice(index, index + length).map((token) => token.word);
			const phrase = span.join(' ');
			const keyword = KEYWORD_TABLE.get(phrase);
			const entity = entities.get(phrase);

			if (keyword) {
				found = { piece: { kind: 'keyword', keyword }, length };
			} else if (entity) {
				found = { piece: { kind: 'entity', entity }, length };
			}

			if (found) {
				break;
			}
		}

		const token = tokens[index];

		if (!found && token) {
			const code = codes.get(token.word);

			if (/^\d+$/.test(token.word)) {
				found = { piece: { kind: 'number', value: Number(token.word) }, length: 1 };
			} else if (code && (token.upper || !CODES_NEEDING_CAPS.has(token.word))) {
				found = { piece: { kind: 'entity', entity: code }, length: 1 };
			} else if (!STOPWORDS.has(token.word)) {
				for (let length = Math.min(3, tokens.length - index); length > 0 && !found; length--) {
					const span = tokens.slice(index, index + length).map((item) => item.word);
					const entity = fuzzyPhrase(span, fuzzy);

					if (entity) {
						found = { piece: { kind: 'entity', entity }, length };
					}
				}
			}
		}

		result.push(found?.piece ?? { kind: 'word', word: token?.word ?? '' });
		index += found?.length ?? 1;
	}

	return result;
}

const FIRST_SEASON = 1950;

function isYear(value: number, context: AskContext): boolean {
	return value >= FIRST_SEASON && value <= context.season + 1;
}

/** What the pieces say, before deciding which question it is. */
type Reading = {
	subjects: Subject[];
	events: string[];
	sessions: AskSession[];
	stat: AskStat | null;
	insight: AskInsight | null;
	standings: { teams: boolean } | null;
	teamsWord: boolean;
	result: boolean;
	story: boolean;
	did: boolean;
	win: boolean;
	pole: boolean;
	teammates: boolean;
	latest: boolean;
	open: boolean;
	most: boolean;
	next: boolean;
	when: boolean;
	gap: boolean;
	penalty: boolean;
	age: boolean;
	youngest: boolean;
	pace: boolean;
	quicker: boolean;
	longRun: boolean;
	stint: number | null;
	lastLaps: number | null;
	compound: AskCompound | null;
	seasons: SeasonSpan | undefined;
	round: number | null;
	afterRound: number | null;
	afterEvent: string | null;
	recognised: number;
};

function read(text: string, context: AskContext): Reading {
	const list = pieces(text, context);
	const years: number[] = [];
	let since: number | null = null;
	let range: { from: number; to: number } | null = null;
	let allTime = false;
	let lastSeasons: number | null = null;

	const reading: Reading = {
		subjects: [],
		events: [],
		sessions: [],
		stat: null,
		insight: null,
		standings: null,
		teamsWord: false,
		result: false,
		story: false,
		did: false,
		win: false,
		pole: false,
		teammates: false,
		latest: false,
		open: false,
		most: false,
		next: false,
		when: false,
		gap: false,
		penalty: false,
		age: false,
		youngest: false,
		pace: false,
		quicker: false,
		longRun: false,
		stint: null,
		lastLaps: null,
		compound: null,
		seasons: undefined,
		round: null,
		afterRound: null,
		afterEvent: null,
		recognised: 0
	};

	for (const [index, piece] of list.entries()) {
		const previous = list[index - 1];
		const next = list[index + 1];

		const afterKeyword = (kind: Keyword['kind']) =>
			previous?.kind === 'keyword' && previous.keyword.kind === kind;

		if (piece.kind !== 'word') {
			reading.recognised++;
		}

		if (piece.kind === 'number') {
			if (afterKeyword('stint')) {
				reading.stint = piece.value;
			} else if (
				afterKeyword('latest') &&
				next?.kind === 'keyword' &&
				next.keyword.kind === 'laps'
			) {
				reading.lastLaps = piece.value;
			} else if (afterKeyword('round')) {
				if (afterKeywordAt(list, index - 2, 'after')) {
					reading.afterRound = piece.value;
				} else {
					reading.round = piece.value;
				}
			} else if (isYear(piece.value, context)) {
				if (afterKeyword('since')) {
					since = piece.value;
				} else if (afterKeyword('range-to') && (years.length > 0 || since !== null)) {
					range = { from: years.pop() ?? since ?? piece.value, to: piece.value };
				} else {
					years.push(piece.value);
				}
			} else if (
				afterKeyword('latest') &&
				next?.kind === 'keyword' &&
				next.keyword.kind === 'seasons'
			) {
				lastSeasons = piece.value;
			}

			continue;
		}

		if (piece.kind === 'entity') {
			const { entity } = piece;

			if (entity.kind === 'event') {
				if (afterKeyword('after')) {
					reading.afterEvent = entity.id;
				} else if (!reading.events.includes(entity.id)) {
					reading.events.push(entity.id);
				}
			} else if (
				!reading.subjects.some(
					(subject) => subject.kind === entity.kind && subject.id === entity.id
				)
			) {
				reading.subjects.push({ kind: entity.kind, id: entity.id });
			}

			continue;
		}

		if (piece.kind !== 'keyword') {
			continue;
		}

		const { keyword } = piece;

		switch (keyword.kind) {
			case 'session': {
				reading.sessions.push(keyword.session);
				break;
			}

			case 'stat': {
				// "the 2023 season" names a season, not a summary, unless a driver or team is asked about.
				if (keyword.stat !== 'summary' || reading.stat === null) {
					reading.stat = keyword.stat;
				}

				break;
			}

			case 'insight': {
				reading.insight = keyword.insight;
				break;
			}

			case 'standings': {
				reading.standings = { teams: keyword.teams || (reading.standings?.teams ?? false) };
				break;
			}

			case 'teams': {
				reading.teamsWord = true;
				break;
			}

			case 'result': {
				reading.result = true;
				break;
			}

			case 'story': {
				reading.story = true;
				break;
			}

			case 'did': {
				reading.did = true;
				break;
			}

			case 'win': {
				reading.win = true;
				break;
			}

			case 'pole': {
				reading.pole = true;
				break;
			}

			case 'teammates': {
				reading.teammates = true;
				break;
			}

			case 'latest': {
				reading.latest = true;
				break;
			}

			case 'open': {
				reading.open = true;
				break;
			}

			case 'most': {
				reading.most = true;
				break;
			}

			case 'next': {
				reading.next = true;
				break;
			}

			case 'when': {
				reading.when = true;
				break;
			}

			case 'gap': {
				reading.gap = true;
				break;
			}

			case 'penalty': {
				reading.penalty = true;
				break;
			}

			case 'age': {
				reading.age = true;
				break;
			}

			case 'youngest': {
				reading.youngest = true;
				break;
			}

			case 'pace': {
				reading.pace = true;
				break;
			}

			case 'quicker': {
				reading.quicker = true;
				break;
			}

			case 'long-run': {
				reading.longRun = true;
				break;
			}

			case 'stint-number': {
				reading.stint = keyword.stint;
				break;
			}

			case 'compound': {
				reading.compound = keyword.compound;
				break;
			}

			case 'all-time': {
				allTime = true;
				break;
			}

			case 'this-season': {
				years.push(context.season);
				break;
			}

			case 'last-season': {
				years.push(context.season - 1);
				break;
			}

			default: {
				break;
			}
		}
	}

	if (range) {
		reading.seasons = range;
	} else if (since !== null) {
		reading.seasons = { from: since, to: context.season };
	} else if (lastSeasons !== null) {
		reading.seasons = { from: context.season - lastSeasons + 1, to: context.season };
		reading.latest = false;
	} else if (years.length > 0) {
		reading.seasons = { from: Math.min(...years), to: Math.max(...years) };
	} else if (allTime) {
		reading.seasons = null;
	}

	return reading;
}

function afterKeywordAt(list: readonly Piece[], index: number, kind: Keyword['kind']): boolean {
	const piece = list[index];

	return piece?.kind === 'keyword' && piece.keyword.kind === kind;
}

const PRACTICE: ReadonlySet<AskSession> = new Set(['practice_1', 'practice_2', 'practice_3']);

/** The session a question points at, or null when it names none. */
function sessionRef(
	reading: Reading,
	context: AskContext,
	fallback: AskSession
): SessionRef | null {
	const session = reading.sessions.at(-1) ?? (reading.pole ? 'qualifying' : fallback);
	const event = reading.events[0];

	if (event !== undefined) {
		return { kind: 'event', event, season: reading.seasons?.to ?? null, session };
	}

	if (reading.round !== null) {
		return {
			kind: 'round',
			season: reading.seasons?.to ?? context.season,
			round: reading.round,
			session
		};
	}

	if (reading.latest) {
		return { kind: 'latest', session };
	}

	if (reading.open) {
		return { kind: 'open' };
	}

	return null;
}

/** A pace question, or null when the reading asks for something else. */
function paceQuery(reading: Reading, context: AskContext): Query | null {
	const [first, second] = reading.subjects;
	const twoDrivers = first?.kind === 'driver' && second?.kind === 'driver';

	// Points and season wording is the standings' gap; a team-mate pace gap names a session or none.
	const mates =
		reading.teammates &&
		reading.gap &&
		!reading.insight &&
		reading.stat === null &&
		reading.seasons === undefined;

	const wanted =
		reading.pace ||
		reading.longRun ||
		mates ||
		reading.stint !== null ||
		reading.lastLaps !== null ||
		(reading.compound !== null && !reading.insight && (reading.quicker || first || second)) ||
		(reading.quicker && twoDrivers && sessionRef(reading, context, 'race') !== null);

	if (
		!wanted ||
		reading.insight ||
		reading.win ||
		reading.pole ||
		reading.standings ||
		reading.stat !== null
	) {
		return null;
	}

	const word = reading.sessions.at(-1);

	const mode: PaceMode = reading.longRun
		? 'long_run'
		: mates
			? 'teammates'
			: twoDrivers
				? 'versus'
				: 'ranking';

	const fallback: AskSession = mode === 'long_run' ? 'practice_2' : 'race';

	// "The latest 10 laps" is a span, not the latest session.
	const named = sessionRef(
		reading.lastLaps === null ? reading : { ...reading, latest: false },
		context,
		fallback
	);

	const session: SessionRef =
		named ?? (word ? { kind: 'latest', session: word } : { kind: 'open' });

	const span: PaceSpan =
		reading.stint !== null
			? { kind: 'stint', stint: reading.stint }
			: reading.lastLaps !== null
				? { kind: 'last', laps: reading.lastLaps }
				: { kind: 'race' };

	return {
		kind: 'pace',
		mode,
		session,
		a: first ?? null,
		b: twoDrivers ? second : null,
		span,
		compound: reading.compound
	};
}

function decide(reading: Reading, context: AskContext): Query | null {
	const [first, second] = reading.subjects;
	const seasons = reading.seasons === undefined ? null : reading.seasons;
	const sessionWord = reading.sessions.at(-1);

	if (reading.youngest) {
		return { kind: 'youngest_winner', seasons };
	}

	if (first?.kind === 'driver' && !second) {
		if (reading.age) {
			return { kind: 'age', subject: first };
		}

		if (reading.penalty) {
			return { kind: 'penalties', subject: first, seasons, event: reading.events[0] ?? null };
		}
	}

	const pace = paceQuery(reading, context);

	if (pace) {
		return pace;
	}

	if (reading.gap && !second) {
		return {
			kind: 'gap',
			table:
				first?.kind === 'team' || (!first && (reading.standings?.teams || reading.teamsWord))
					? 'teams'
					: 'drivers',
			subject: first ?? null,
			season: reading.seasons?.to ?? context.season
		};
	}

	const asksResult =
		reading.win || reading.pole || reading.result || reading.stat !== null || reading.insight;

	if (
		(reading.next || reading.when) &&
		!asksResult &&
		!reading.standings &&
		!first &&
		reading.seasons === undefined &&
		reading.round === null
	) {
		return { kind: 'schedule', session: sessionWord ?? null, event: reading.events[0] ?? null };
	}

	if (first && second && first.kind === second.kind) {
		const focus =
			sessionWord === 'qualifying' || sessionWord === 'race' || sessionWord === 'sprint'
				? sessionWord
				: reading.pole || reading.stat === 'poles'
					? 'qualifying'
					: reading.win || reading.stat === 'wins'
						? 'race'
						: null;

		return { kind: 'h2h', a: first, b: second, seasons, teammates: reading.teammates, focus };
	}

	if (reading.standings) {
		const after =
			reading.afterRound !== null
				? { round: reading.afterRound }
				: reading.round !== null
					? { round: reading.round }
					: (reading.afterEvent ?? reading.events[0])
						? { event: reading.afterEvent ?? reading.events[0] ?? '' }
						: null;

		return {
			kind: 'standings',
			table:
				reading.standings.teams || reading.teamsWord || first?.kind === 'team'
					? 'teams'
					: 'drivers',
			season: reading.seasons?.to ?? context.season,
			after
		};
	}

	const subject = first ?? null;

	// "What happened to X", "how did X do", "why did X retire", "did X finish": the driver's race.
	if (first?.kind === 'driver' && (reading.story || (reading.did && reading.result))) {
		const ref =
			sessionRef(reading, context, 'race') ??
			(reading.seasons === undefined
				? { kind: 'latest' as const, session: 'race' as const }
				: null);

		if (ref && (ref.kind === 'open' || ref.session === 'race' || ref.session === 'sprint')) {
			return { kind: 'story', session: ref, subject: first };
		}
	}

	if (reading.insight) {
		const ref = sessionRef(reading, context, 'race');

		if (reading.insight === 'fastest_lap' && subject && !ref) {
			return { kind: 'record', subject, stat: 'fastest_laps', seasons };
		}

		if (ref) {
			return { kind: 'insight', insight: reading.insight, session: ref, subject };
		}

		return reading.seasons === undefined
			? { kind: 'insight', insight: reading.insight, session: { kind: 'open' }, subject }
			: null;
	}

	const ref = sessionRef(reading, context, 'race');

	if (ref) {
		return ref.kind !== 'open' && PRACTICE.has(ref.session)
			? { kind: 'insight', insight: 'fastest_lap', session: ref, subject }
			: { kind: 'result', session: ref, subject };
	}

	const counted = reading.stat === null || reading.stat === 'starts' || reading.stat === 'summary';
	const stat = reading.win && counted ? 'wins' : reading.pole && counted ? 'poles' : reading.stat;

	if (subject) {
		if (stat) {
			return { kind: 'record', subject, stat, seasons };
		}

		return reading.seasons === undefined
			? null
			: { kind: 'record', subject, stat: 'summary', seasons };
	}

	if (stat && stat !== 'summary') {
		return {
			kind: 'leaders',
			table: reading.teamsWord ? 'teams' : 'drivers',
			stat,
			seasons
		};
	}

	return null;
}

/** The parser over the names in `context`. */
export function createResolver(context: AskContext): Resolver {
	return (text) => decide(read(text, context), context);
}

/** One question to a query; see `createResolver`. */
export function resolve(text: string, context: AskContext): Query | null {
	return createResolver(context)(text);
}

const SESSION_WORD: Record<AskSession, string> = {
	race: 'race',
	qualifying: 'qualifying',
	sprint: 'sprint',
	sprint_qualifying: 'sprint qualifying',
	practice_1: 'FP1',
	practice_2: 'FP2',
	practice_3: 'FP3'
};

const STAT_WORD: Record<AskStat, string> = {
	wins: 'wins',
	poles: 'poles',
	podiums: 'podiums',
	points: 'points',
	dnfs: 'DNFs',
	fastest_laps: 'fastest laps',
	starts: 'starts',
	laps_led: 'laps led',
	q3: 'Q3 appearances',
	summary: 'stats'
};

const INSIGHT_WORD: Record<AskInsight, string> = {
	fastest_lap: 'Fastest lap',
	top_speed: 'Top speed',
	tyres: 'Tyre strategy',
	pit_stops: 'Pit stops',
	sectors: 'Sectors'
};

function labelOf(context: AskContext, kind: AskEntity['kind'], id: string): string {
	return context.entities.find((entity) => entity.kind === kind && entity.id === id)?.label ?? id;
}

function seasonsText(seasons: SeasonSpan, context: AskContext, all: string): string {
	if (seasons === null) {
		return all;
	}

	if (seasons.from === seasons.to) {
		return String(seasons.from);
	}

	return seasons.to === context.season ? `since ${seasons.from}` : `${seasons.from}-${seasons.to}`;
}

/** Where a session is, as words: "at Italian GP 2024 qualifying", "in the last race". */
function sessionText(ref: SessionRef, context: AskContext, race: string): string {
	switch (ref.kind) {
		case 'open': {
			return 'in this session';
		}

		case 'latest': {
			return `in the last ${SESSION_WORD[ref.session]}`;
		}

		case 'event': {
			const season = ref.season === null ? '' : ` ${ref.season}`;
			const session = ref.session === 'race' ? race : ` ${SESSION_WORD[ref.session]}`;

			return `at ${labelOf(context, 'event', ref.event)}${season}${session}`;
		}

		case 'round': {
			return `in round ${ref.round} ${ref.season} ${SESSION_WORD[ref.session]}`;
		}
	}
}

/** Who won a session, or who took pole, as a question: "Who won the Italian GP 2024". */
function winnerText(ref: SessionRef, context: AskContext): string {
	if (ref.kind === 'open') {
		return 'Who won this session';
	}

	if (ref.session === 'qualifying') {
		return `Who was on pole ${sessionText(ref, context, '')}`;
	}

	if (ref.session !== 'race' && ref.session !== 'sprint') {
		return `Result ${sessionText(ref, context, ' race')}`;
	}

	const sprint = ref.session === 'sprint' ? 'the sprint ' : '';

	switch (ref.kind) {
		case 'latest': {
			return `Who won the last ${ref.session}`;
		}

		case 'event': {
			const season = ref.season === null ? '' : ` ${ref.season}`;
			const event = labelOf(context, 'event', ref.event);

			return sprint ? `Who won the sprint at ${event}${season}` : `Who won the ${event}${season}`;
		}

		case 'round': {
			return `Who won ${sprint || 'the race '}in round ${ref.round} ${ref.season}`;
		}
	}
}

const COMPOUND_WORD: Record<AskCompound, string> = {
	SOFT: 'softs',
	MEDIUM: 'mediums',
	HARD: 'hards',
	INTERMEDIATE: 'intermediates',
	WET: 'wets'
};

function paceText(query: Extract<Query, { kind: 'pace' }>, context: AskContext): string {
	const label = (subject: Subject | null) =>
		subject ? labelOf(context, subject.kind, subject.id) : '';

	const span =
		query.span.kind === 'stint'
			? ` stint ${query.span.stint}`
			: query.span.kind === 'last'
				? ` last ${query.span.laps} laps`
				: '';

	const compound = query.compound === null ? '' : ` on ${COMPOUND_WORD[query.compound]}`;
	const where = ` ${sessionText(query.session, context, '')}`;

	switch (query.mode) {
		case 'versus': {
			return `${label(query.a)} vs ${label(query.b)} pace${span}${compound}${where}`;
		}

		case 'teammates': {
			return `${query.a ? `${label(query.a)} ` : ''}team mate gap${span}${compound}${where}`;
		}

		case 'long_run': {
			return `Best long run${where}`;
		}

		case 'ranking': {
			const who = query.a ? `${label(query.a)} ` : '';

			return `${who}race pace${span}${compound}${where}`;
		}
	}
}

/** A query as a question the parser reads back to the same query, for examples and sharing. */
export function questionText(query: Query, context: AskContext): string {
	const subjectLabel = (subject: Subject) => labelOf(context, subject.kind, subject.id);

	switch (query.kind) {
		case 'result': {
			if (query.subject) {
				return `Result of ${subjectLabel(query.subject)} ${sessionText(query.session, context, '')}`;
			}

			return winnerText(query.session, context);
		}

		case 'story': {
			return `What happened to ${subjectLabel(query.subject)} ${sessionText(query.session, context, '')}`;
		}

		case 'insight': {
			const who = query.subject ? ` of ${subjectLabel(query.subject)}` : '';

			return `${INSIGHT_WORD[query.insight]}${who} ${sessionText(query.session, context, '')}`;
		}

		case 'standings': {
			const table = query.table === 'teams' ? 'Constructors standings' : 'Standings';

			const after =
				query.after === null
					? ''
					: 'round' in query.after
						? ` after round ${query.after.round}`
						: ` after ${labelOf(context, 'event', query.after.event)}`;

			return `${table} ${query.season}${after}`;
		}

		case 'h2h': {
			const teammates = query.teammates ? ' as teammates' : '';
			const focus = query.focus === null ? '' : ` ${SESSION_WORD[query.focus]}`;

			return `${subjectLabel(query.a)} vs ${subjectLabel(query.b)}${teammates} ${seasonsText(query.seasons, context, 'career')}${focus}`;
		}

		case 'record': {
			const who = subjectLabel(query.subject);

			return query.seasons === null
				? `${who} career ${STAT_WORD[query.stat]}`
				: `${who} ${STAT_WORD[query.stat]} ${seasonsText(query.seasons, context, '')}`;
		}

		case 'leaders': {
			const who = query.table === 'teams' ? 'Which teams have' : 'Who has';

			const span = seasonsText(query.seasons, context, 'ever');
			const when = query.seasons === null || span.startsWith('since') ? span : `in ${span}`;

			return `${who} the most ${STAT_WORD[query.stat]} ${when}`;
		}

		case 'schedule': {
			const session = query.session === null ? 'session' : SESSION_WORD[query.session];
			const where = query.event === null ? '' : ` at ${labelOf(context, 'event', query.event)}`;

			return `When is the next ${session}${where}`;
		}

		case 'gap': {
			if (query.subject) {
				return `How many points is ${subjectLabel(query.subject)} behind in ${query.season}`;
			}

			return `${query.table === 'teams' ? 'Constructors gap' : 'Gap'} to the leader in ${query.season}`;
		}

		case 'penalties': {
			const who = subjectLabel(query.subject);

			return query.event === null
				? `Penalties for ${who} ${seasonsText(query.seasons, context, 'career')}`
				: `Why was ${who} penalised in ${labelOf(context, 'event', query.event)}`;
		}

		case 'age': {
			return `How old is ${subjectLabel(query.subject)}`;
		}

		case 'pace': {
			return paceText(query, context);
		}

		case 'youngest_winner': {
			return `Youngest race winner ${seasonsText(query.seasons, context, 'ever')}`;
		}
	}
}

/**
 * Questions close to `text` that the parser understands, built from the names it recognised:
 * what the palette offers when a question does not parse, so the list is never empty.
 */
export function suggest(text: string, context: AskContext, limit = 4): string[] {
	const reading = read(text, context);
	const season = context.season;
	const seasons = reading.seasons === undefined ? { from: season, to: season } : reading.seasons;
	const [a, b] = reading.subjects;
	const event = reading.events[0];
	const candidates: Query[] = [];

	if (a && b && a.kind === b.kind) {
		candidates.push(
			{ kind: 'h2h', a, b, seasons, teammates: false, focus: null },
			{ kind: 'h2h', a, b, seasons: null, teammates: false, focus: null }
		);
	}

	for (const subject of [a, b]) {
		if (subject) {
			candidates.push(
				{ kind: 'record', subject, stat: reading.stat ?? 'summary', seasons },
				{ kind: 'record', subject, stat: 'wins', seasons: { from: season - 3, to: season } }
			);
		}
	}

	if (event !== undefined) {
		const ref = (session: AskSession): SessionRef => ({
			kind: 'event',
			event,
			season: reading.seasons?.to ?? null,
			session
		});

		candidates.push(
			{ kind: 'result', session: ref('race'), subject: null },
			{ kind: 'result', session: ref('qualifying'), subject: null },
			{ kind: 'insight', insight: 'fastest_lap', session: ref('race'), subject: null }
		);
	}

	if (reading.insight) {
		candidates.push({
			kind: 'insight',
			insight: reading.insight,
			session: { kind: 'latest', session: 'race' },
			subject: null
		});
	}

	if (reading.stat && reading.stat !== 'summary') {
		candidates.push({ kind: 'leaders', table: 'drivers', stat: reading.stat, seasons });
	}

	if (reading.next || reading.when) {
		candidates.push({ kind: 'schedule', session: reading.sessions.at(-1) ?? 'race', event: null });
	}

	candidates.push(
		{ kind: 'result', session: { kind: 'latest', session: 'race' }, subject: null },
		{ kind: 'standings', table: 'drivers', season, after: null },
		{ kind: 'leaders', table: 'drivers', stat: 'poles', seasons: { from: season - 3, to: season } },
		{ kind: 'insight', insight: 'top_speed', session: { kind: 'open' }, subject: null }
	);

	const parse = createResolver(context);

	const texts = candidates.flatMap((query) => {
		const question = questionText(query, context);

		return parse(question) === null ? [] : [question];
	});

	return [...new Set(texts)].slice(0, limit);
}
