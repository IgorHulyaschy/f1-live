import type { AskContext, AskEntity } from './ask.ts';

const driver = (id: string, label: string, code: string, ...names: string[]): AskEntity => ({
	kind: 'driver',
	id,
	label,
	names: [id.replaceAll('-', ' '), label, ...names],
	codes: [code]
});

const team = (id: string, label: string, ...names: string[]): AskEntity => ({
	kind: 'team',
	id,
	label,
	names: [label, ...names]
});

const event = (id: string, label: string, ...names: string[]): AskEntity => ({
	kind: 'event',
	id,
	label,
	names: [label, ...names]
});

/** Names as the client builds them from the results index and the catalog, trimmed for tests. */
export const ASK_TEST_CONTEXT: AskContext = {
	season: 2025,
	entities: [
		driver('max-verstappen', 'Verstappen', 'VER', 'max'),
		driver('lando-norris', 'Norris', 'NOR', 'lando'),
		driver('oscar-piastri', 'Piastri', 'PIA', 'oscar'),
		driver('charles-leclerc', 'Leclerc', 'LEC', 'charles'),
		driver('lewis-hamilton', 'Hamilton', 'HAM', 'lewis'),
		driver('george-russell', 'Russell', 'RUS', 'george'),
		driver('carlos-sainz', 'Sainz', 'SAI', 'carlos'),
		driver('fernando-alonso', 'Alonso', 'ALO', 'fernando', 'nando'),
		driver('sergio-perez', 'Perez', 'PER', 'checo', 'sergio'),
		driver('valtteri-bottas', 'Bottas', 'BOT', 'valtteri'),
		driver('kimi-antonelli', 'Antonelli', 'ANT', 'kimi antonelli', 'andrea kimi antonelli'),
		driver('kimi-raikkonen', 'Raikkonen', 'RAI', 'kimi'),
		driver('liam-lawson', 'Lawson', 'LAW', 'liam'),
		driver('pierre-gasly', 'Gasly', 'GAS', 'pierre'),
		driver('sebastian-vettel', 'Vettel', 'VET', 'seb'),
		team('red-bull', 'Red Bull', 'red bull racing', 'rbr'),
		team('mclaren', 'McLaren'),
		team('ferrari', 'Ferrari', 'scuderia ferrari'),
		team('mercedes', 'Mercedes', 'merc'),
		team('aston-martin', 'Aston Martin', 'aston', 'racing point'),
		team('alpine', 'Alpine', 'renault'),
		team('williams', 'Williams'),
		event('italian', 'Italian GP', 'italian grand prix', 'italy', 'monza'),
		event('las-vegas', 'Las Vegas GP', 'las vegas grand prix', 'las vegas', 'vegas'),
		event('british', 'British GP', 'british grand prix', 'great britain', 'silverstone'),
		event('monaco', 'Monaco GP', 'monaco grand prix', 'monaco', 'monte carlo'),
		event('azerbaijan', 'Azerbaijan GP', 'azerbaijan grand prix', 'azerbaijan', 'baku'),
		event('bahrain', 'Bahrain GP', 'bahrain grand prix', 'bahrain', 'sakhir'),
		event('sakhir', 'Sakhir GP', 'sakhir grand prix'),
		event('abu-dhabi', 'Abu Dhabi GP', 'abu dhabi grand prix', 'abu dhabi', 'yas marina'),
		event('belgian', 'Belgian GP', 'belgian grand prix', 'belgium', 'spa'),
		event('japanese', 'Japanese GP', 'japanese grand prix', 'japan', 'suzuka'),
		event('sao-paulo', 'Sao Paulo GP', 'sao paulo grand prix', 'brazil', 'interlagos', 'sao paulo'),
		event('united-states', 'United States GP', 'united states grand prix', 'austin', 'cota', 'usa')
	]
};
