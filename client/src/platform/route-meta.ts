import { BRAND } from '../brand.ts';
import { type Dashboard, isPreset, tileTitle } from '../features/dashboard/dashboards.ts';
import { COMMUNITY } from '../features/library/community.ts';
import { decodeShare } from '../features/library/share.ts';

/** What a page tells the browser tab, search engines and share cards. */
export type PageMeta = {
	/** The page's own name; null on the home page, which leads with the brand instead. */
	title: string | null;
	description: string;
	/** False for pages that belong to one viewer: their dashboards, shared links and pop-outs. */
	indexed: boolean;
};

export type RouteMetaInput = {
	params: Readonly<Partial<Record<string, string>>>;
	search: URLSearchParams;
	/** The viewer's dashboards, presets included, so their own pages carry their names. */
	dashboards: readonly Dashboard[];
};

export type RouteMeta = (input: RouteMetaInput) => PageMeta;

/** Ready-made dashboards at /d/:id, described for search results. */
const PRESET_DESCRIPTIONS: ReadonlyMap<string, string> = new Map([
	['battle', 'Your driver’s fight: the car ahead and the car behind, gap by gap, lap by lap.'],
	['drivers', 'The whole grid as pictures, your driver up close and every change of position.'],
	['wall', 'Timing, flags, gaps and stints that fill a TV or a second monitor.'],
	['story', 'The race told lap by lap: the moves, the stops and the championship swing.']
]);

const page =
	(title: string | null, description: string, indexed = true): RouteMeta =>
	() => ({ title, description, indexed });

export const ROUTE_META = {
	live: page(null, BRAND.description),
	analysis: page(
		'Analysis',
		'Lap time charts for any drivers you pick, true pace with fuel and tyres taken out, and the fastest laps.'
	),
	strategy: page(
		'Strategy',
		'Tyre stints, wear and every pit stop: who can still stop, and what a stop would cost.'
	),
	dashboard: ({ params, dashboards }) => {
		const id = params.id ?? '';
		const name = dashboards.find((dashboard) => dashboard.id === id)?.name ?? 'Dashboard';

		if (!isPreset(id)) {
			return { title: name, description: 'A dashboard saved in this browser.', indexed: false };
		}

		return {
			title: name,
			description: PRESET_DESCRIPTIONS.get(id) ?? `${name}: a ready-made dashboard of race tiles.`,
			indexed: true
		};
	},
	library: page(
		'Library',
		'Ready-made dashboards and ones other fans built. Preview any of them live and add a copy to make it yours.'
	),
	libraryEntry: ({ params }) => {
		const entry = COMMUNITY.find((item) => item.id === params.entryId);

		return entry
			? {
					title: `${entry.dashboard.name} by @${entry.author}`,
					description: entry.description,
					indexed: true
				}
			: { title: 'Library', description: 'A dashboard from the library.', indexed: false };
	},
	shared: ({ search }) => {
		const code = search.get('d');
		const dashboard = code ? decodeShare(code) : null;

		return {
			title: dashboard ? `${dashboard.name}: shared dashboard` : 'Shared dashboard',
			description: 'A dashboard shared with you. Preview it live, then add a copy to your own.',
			indexed: false
		};
	},
	calendar: page(
		'Calendar',
		'Every weekend of the season in your own time, with countdowns and an .ics file for your calendar.'
	),
	standings: page(
		'Standings',
		'The drivers’ and constructors’ championships for any season since 2018, after any round.'
	),
	headToHead: page(
		'Head to head',
		'Any two drivers or teams since 2018: qualifying and race battles, gaps, points and the facts behind them.'
	),
	driver: ({ params }) => ({
		title: 'Driver',
		description: `Every weekend, season and teammate of ${params.id ?? 'a driver'} since 2018.`,
		indexed: true
	}),
	welcome: page('Set up', 'Pick the driver you follow and the dashboard you start on.', false),
	account: page('Account', 'Your sign-in, plan and dashboards.', false),
	tile: ({ params, dashboards }) => {
		const tile = dashboards
			.find((dashboard) => dashboard.id === params.dashboardId)
			?.tiles.find((entry) => entry.id === params.tileId);

		return {
			title: tile ? tileTitle(tile) : 'Tile',
			description: 'One tile in its own window, in step with the main screen.',
			indexed: false
		};
	}
} satisfies Record<string, RouteMeta>;
