import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createResolver, questionText, suggest, type Query, type Subject } from './ask.ts';
import { ASK_TEST_CONTEXT } from './ask-fixture.ts';

const resolve = createResolver(ASK_TEST_CONTEXT);

const driver = (id: string): Subject => ({ kind: 'driver', id });

const team = (id: string): Subject => ({ kind: 'team', id });

const VER = driver('max-verstappen');

const NOR = driver('lando-norris');

const PIA = driver('oscar-piastri');

const LEC = driver('charles-leclerc');

const HAM = driver('lewis-hamilton');

const RUS = driver('george-russell');

const SAI = driver('carlos-sainz');

const ALO = driver('fernando-alonso');

const PER = driver('sergio-perez');

const BOT = driver('valtteri-bottas');

const ANT = driver('kimi-antonelli');

const LAW = driver('liam-lawson');

const VET = driver('sebastian-vettel');

const RED_BULL = team('red-bull');

const MCLAREN = team('mclaren');

const FERRARI = team('ferrari');

const MERCEDES = team('mercedes');

const QUESTIONS: { text: string; expected: Query | null }[] = [
	// Results
	{
		text: 'who won monza 2024',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'italian', season: 2024, session: 'race' },
			subject: null
		}
	},
	{
		text: 'who was on pole at baku',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'azerbaijan', season: null, session: 'qualifying' },
			subject: null
		}
	},
	{
		text: 'how did hamilton do at silverstone 2024',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'british', season: 2024, session: 'race' },
			subject: HAM
		}
	},
	{
		text: 'last race result',
		expected: {
			kind: 'result',
			session: { kind: 'latest', session: 'race' },
			subject: null
		}
	},
	{
		text: 'monaco qualifying 2023',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'monaco', season: 2023, session: 'qualifying' },
			subject: null
		}
	},
	{
		text: 'sprint results austin 2024',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'united-states', season: 2024, session: 'sprint' },
			subject: null
		}
	},
	{
		text: 'latest qualifying results',
		expected: {
			kind: 'result',
			session: { kind: 'latest', session: 'qualifying' },
			subject: null
		}
	},
	{
		text: 'how did russell finish at spa 2023',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'belgian', season: 2023, session: 'race' },
			subject: RUS
		}
	},
	{
		text: 'who won in japan',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'japanese', season: null, session: 'race' },
			subject: null
		}
	},
	{
		text: 'round 5 2025 results',
		expected: {
			kind: 'result',
			session: { kind: 'round', season: 2025, round: 5, session: 'race' },
			subject: null
		}
	},
	{
		text: 'pole sitter at suzuka 2025',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'japanese', season: 2025, session: 'qualifying' },
			subject: null
		}
	},
	{
		text: 'where did Sainz qualify at Abu Dhabi 2024 qualifying',
		expected: {
			kind: 'result',
			session: { kind: 'event', event: 'abu-dhabi', season: 2024, session: 'qualifying' },
			subject: SAI
		}
	},

	// Standings
	{
		text: 'standings after round 10 2024',
		expected: { kind: 'standings', table: 'drivers', season: 2024, after: { round: 10 } }
	},
	{
		text: 'constructors championship 2021',
		expected: { kind: 'standings', table: 'teams', season: 2021, after: null }
	},
	{
		text: 'who led the championship after Monza 2024',
		expected: { kind: 'standings', table: 'drivers', season: 2024, after: { event: 'italian' } }
	},
	{
		text: 'driver standings 2023',
		expected: { kind: 'standings', table: 'drivers', season: 2023, after: null }
	},
	{
		text: 'constructors standings after round 12',
		expected: { kind: 'standings', table: 'teams', season: 2025, after: { round: 12 } }
	},
	{
		text: 'wcc 2022',
		expected: { kind: 'standings', table: 'teams', season: 2022, after: null }
	},
	{
		text: 'championship table this season',
		expected: { kind: 'standings', table: 'drivers', season: 2025, after: null }
	},

	// Head to head
	{
		text: 'NOR vs PIA 2024 quali',
		expected: {
			kind: 'h2h',
			a: NOR,
			b: PIA,
			seasons: { from: 2024, to: 2024 },
			teammates: false,
			focus: 'qualifying'
		}
	},
	{
		text: 'leclrec vs sainz as teammates',
		expected: { kind: 'h2h', a: LEC, b: SAI, seasons: null, teammates: true, focus: null }
	},
	{
		text: 'Hamilton v Russell 2022-2024',
		expected: {
			kind: 'h2h',
			a: HAM,
			b: RUS,
			seasons: { from: 2022, to: 2024 },
			teammates: false,
			focus: null
		}
	},
	{
		text: 'red bull vs mclaren since 2023',
		expected: {
			kind: 'h2h',
			a: RED_BULL,
			b: MCLAREN,
			seasons: { from: 2023, to: 2025 },
			teammates: false,
			focus: null
		}
	},
	{
		text: 'ferrari against mercedes',
		expected: { kind: 'h2h', a: FERRARI, b: MERCEDES, seasons: null, teammates: false, focus: null }
	},
	{
		text: 'max vs lando 2023 race',
		expected: {
			kind: 'h2h',
			a: VER,
			b: NOR,
			seasons: { from: 2023, to: 2023 },
			teammates: false,
			focus: 'race'
		}
	},
	{
		text: 'PER vs VER as teammates 2021-2023',
		expected: {
			kind: 'h2h',
			a: PER,
			b: VER,
			seasons: { from: 2021, to: 2023 },
			teammates: true,
			focus: null
		}
	},
	{
		text: 'vettel vs alonso career',
		expected: { kind: 'h2h', a: VET, b: ALO, seasons: null, teammates: false, focus: null }
	},
	{
		text: 'lewis vs george head to head 2022 to 2024',
		expected: {
			kind: 'h2h',
			a: HAM,
			b: RUS,
			seasons: { from: 2022, to: 2024 },
			teammates: false,
			focus: null
		}
	},

	// Records
	{
		text: 'how many wins has Max since 2021',
		expected: { kind: 'record', subject: VER, stat: 'wins', seasons: { from: 2021, to: 2025 } }
	},
	{
		text: 'verstapen poles 2023',
		expected: { kind: 'record', subject: VER, stat: 'poles', seasons: { from: 2023, to: 2023 } }
	},
	{
		text: 'Hamilton career podiums',
		expected: { kind: 'record', subject: HAM, stat: 'podiums', seasons: null }
	},
	{
		text: 'Alonso DNFs last season',
		expected: { kind: 'record', subject: ALO, stat: 'dnfs', seasons: { from: 2024, to: 2024 } }
	},
	{
		text: 'Norris laps led this season',
		expected: { kind: 'record', subject: NOR, stat: 'laps_led', seasons: { from: 2025, to: 2025 } }
	},
	{
		text: 'piastri points 2024',
		expected: { kind: 'record', subject: PIA, stat: 'points', seasons: { from: 2024, to: 2024 } }
	},
	{
		text: 'bottas fastest laps',
		expected: { kind: 'record', subject: BOT, stat: 'fastest_laps', seasons: null }
	},
	{
		text: 'antonelli wins this year',
		expected: { kind: 'record', subject: ANT, stat: 'wins', seasons: { from: 2025, to: 2025 } }
	},
	{
		text: 'how many podiums does Leclerc have',
		expected: { kind: 'record', subject: LEC, stat: 'podiums', seasons: null }
	},
	{
		text: 'ferrari wins since 2022',
		expected: { kind: 'record', subject: FERRARI, stat: 'wins', seasons: { from: 2022, to: 2025 } }
	},
	{
		text: 'lawson q3 appearances 2025',
		expected: { kind: 'record', subject: LAW, stat: 'q3', seasons: { from: 2025, to: 2025 } }
	},

	// Leaders
	{
		text: 'who has the most poles since 2022',
		expected: {
			kind: 'leaders',
			table: 'drivers',
			stat: 'poles',
			seasons: { from: 2022, to: 2025 }
		}
	},
	{
		text: 'which teams have the most wins in 2024',
		expected: { kind: 'leaders', table: 'teams', stat: 'wins', seasons: { from: 2024, to: 2024 } }
	},
	{
		text: 'most wins ever',
		expected: { kind: 'leaders', table: 'drivers', stat: 'wins', seasons: null }
	},
	{
		text: 'most podiums since 2020',
		expected: {
			kind: 'leaders',
			table: 'drivers',
			stat: 'podiums',
			seasons: { from: 2020, to: 2025 }
		}
	},
	{
		text: 'which teams have the most poles 2021-2024',
		expected: { kind: 'leaders', table: 'teams', stat: 'poles', seasons: { from: 2021, to: 2024 } }
	},
	{
		text: 'who has the most dnfs in 2023',
		expected: { kind: 'leaders', table: 'drivers', stat: 'dnfs', seasons: { from: 2023, to: 2023 } }
	},

	// Session insights
	{
		text: 'fastest lap las vegas 2025',
		expected: {
			kind: 'insight',
			insight: 'fastest_lap',
			session: { kind: 'event', event: 'las-vegas', season: 2025, session: 'race' },
			subject: null
		}
	},
	{
		text: 'top speed in this session',
		expected: { kind: 'insight', insight: 'top_speed', session: { kind: 'open' }, subject: null }
	},
	{
		text: 'tyre strategy last race',
		expected: {
			kind: 'insight',
			insight: 'tyres',
			session: { kind: 'latest', session: 'race' },
			subject: null
		}
	},
	{
		text: 'fastest pit stop at Monza 2024',
		expected: {
			kind: 'insight',
			insight: 'pit_stops',
			session: { kind: 'event', event: 'italian', season: 2024, session: 'race' },
			subject: null
		}
	},
	{
		text: 'sector times bahrain 2025 qualifying',
		expected: {
			kind: 'insight',
			insight: 'sectors',
			session: { kind: 'event', event: 'bahrain', season: 2025, session: 'qualifying' },
			subject: null
		}
	},
	{
		text: 'fp2 bahrain 2025',
		expected: {
			kind: 'insight',
			insight: 'fastest_lap',
			session: { kind: 'event', event: 'bahrain', season: 2025, session: 'practice_2' },
			subject: null
		}
	},
	{
		text: 'max pit stops sao paulo 2024',
		expected: {
			kind: 'insight',
			insight: 'pit_stops',
			session: { kind: 'event', event: 'sao-paulo', season: 2024, session: 'race' },
			subject: VER
		}
	},
	{
		text: 'top speed spa 2024 qualifying',
		expected: {
			kind: 'insight',
			insight: 'top_speed',
			session: { kind: 'event', event: 'belgian', season: 2024, session: 'qualifying' },
			subject: null
		}
	},
	{
		text: 'norris sectors in this session',
		expected: { kind: 'insight', insight: 'sectors', session: { kind: 'open' }, subject: NOR }
	},
	{
		text: 'tyres monaco 2023',
		expected: {
			kind: 'insight',
			insight: 'tyres',
			session: { kind: 'event', event: 'monaco', season: 2023, session: 'race' },
			subject: null
		}
	},

	// Schedule
	{ text: 'when is the next race', expected: { kind: 'schedule', session: 'race', event: null } },
	{ text: 'when is quali', expected: { kind: 'schedule', session: 'qualifying', event: null } },
	{ text: 'next session', expected: { kind: 'schedule', session: null, event: null } },
	{
		text: 'what time is the sprint',
		expected: { kind: 'schedule', session: 'sprint', event: null }
	},
	{
		text: 'when is the monza race',
		expected: { kind: 'schedule', session: 'race', event: 'italian' }
	},
	{ text: 'when is fp1', expected: { kind: 'schedule', session: 'practice_1', event: null } },

	// Gap to the leader
	{
		text: 'how many points is norris behind',
		expected: { kind: 'gap', table: 'drivers', subject: NOR, season: 2025 }
	},
	{
		text: 'gap to the leader',
		expected: { kind: 'gap', table: 'drivers', subject: null, season: 2025 }
	},
	{
		text: 'can norris still win the title',
		expected: { kind: 'gap', table: 'drivers', subject: NOR, season: 2025 }
	},
	{
		text: 'how far is ferrari behind in the constructors',
		expected: { kind: 'gap', table: 'teams', subject: FERRARI, season: 2025 }
	},
	{
		text: 'piastri gap to leader 2024',
		expected: { kind: 'gap', table: 'drivers', subject: PIA, season: 2024 }
	},

	// Stewards' decisions and facts
	{
		text: 'why was norris penalised in las vegas',
		expected: { kind: 'penalties', subject: NOR, seasons: null, event: 'las-vegas' }
	},
	{
		text: 'penalties for verstappen this season',
		expected: { kind: 'penalties', subject: VER, seasons: { from: 2025, to: 2025 }, event: null }
	},
	{
		text: 'hamilton penalties 2024',
		expected: { kind: 'penalties', subject: HAM, seasons: { from: 2024, to: 2024 }, event: null }
	},
	{ text: 'how old is alonso', expected: { kind: 'age', subject: ALO } },
	{ text: 'age of leclerc', expected: { kind: 'age', subject: LEC } },
	{
		text: 'youngest race winner since 2018',
		expected: { kind: 'youngest_winner', seasons: { from: 2018, to: 2025 } }
	},
	{ text: 'youngest winner ever', expected: { kind: 'youngest_winner', seasons: null } },

	// Not understood
	{ text: 'hello there', expected: null },
	{ text: 'is it going to rain', expected: null },
	{ text: 'tell me a joke', expected: null },
	{ text: 'what is the weather', expected: null },
	{ text: 'how are you', expected: null }
];

const ASKED = QUESTIONS.filter(
	(entry): entry is { text: string; expected: Query } => entry.expected !== null
);

test('fixture has enough questions, some of them not understood', () => {
	assert.ok(QUESTIONS.length >= 45);
	assert.ok(QUESTIONS.length - ASKED.length >= 4);
});

test('at least 90% of the questions resolve to the expected query', () => {
	const misses = ASKED.flatMap(({ text, expected }) => {
		const actual = resolve(text);

		try {
			assert.deepEqual(actual, expected);

			return [];
		} catch {
			return [`${text} | ${JSON.stringify(expected)} | ${JSON.stringify(actual)}`];
		}
	});

	assert.ok(
		(ASKED.length - misses.length) / ASKED.length >= 0.9,
		`${misses.length} of ${ASKED.length} missed:\n${misses.join('\n')}`
	);
});

test('questions it cannot understand give null and a list of suggestions that parse', () => {
	for (const { text, expected } of QUESTIONS) {
		if (expected !== null) {
			continue;
		}

		const suggestions = suggest(text, ASK_TEST_CONTEXT);

		assert.equal(resolve(text), null, text);
		assert.ok(suggestions.length > 0, `no suggestions for ${text}`);

		for (const suggestion of suggestions) {
			assert.notEqual(resolve(suggestion), null, `${text} -> ${suggestion}`);
		}
	}
});

test('questionText reads back to the same query', () => {
	const failures = ASKED.flatMap(({ expected }) => {
		const text = questionText(expected, ASK_TEST_CONTEXT);
		const actual = resolve(text);

		try {
			assert.deepEqual(actual, expected);

			return [];
		} catch {
			return [`${text} | ${JSON.stringify(expected)} | ${JSON.stringify(actual)}`];
		}
	});

	assert.deepEqual(failures, []);
});

test('lowercase per is a word, PER is Perez', () => {
	assert.deepEqual(resolve('PER wins 2024'), {
		kind: 'record',
		subject: PER,
		stat: 'wins',
		seasons: { from: 2024, to: 2024 }
	});
	assert.deepEqual(resolve('per wins 2024'), {
		kind: 'leaders',
		table: 'drivers',
		stat: 'wins',
		seasons: { from: 2024, to: 2024 }
	});
});

test('a typo of one edit in a 5 to 7 letter name still matches', () => {
	for (const typo of ['noris', 'norrris', 'nroris']) {
		assert.deepEqual(
			resolve(`${typo} poles 2024`),
			{ kind: 'record', subject: NOR, stat: 'poles', seasons: { from: 2024, to: 2024 } },
			typo
		);
	}

	assert.deepEqual(resolve('rusell wins 2024'), {
		kind: 'record',
		subject: RUS,
		stat: 'wins',
		seasons: { from: 2024, to: 2024 }
	});
});

test('three ways to write a span give the same seasons', () => {
	const spans = [
		'ham vs rus 2019-2021',
		'ham vs rus from 2019 to 2021',
		'ham vs rus between 2019 and 2021'
	];

	for (const text of spans) {
		assert.deepEqual(
			resolve(text),
			{
				kind: 'h2h',
				a: HAM,
				b: RUS,
				seasons: { from: 2019, to: 2021 },
				teammates: false,
				focus: null
			},
			text
		);
	}
});
