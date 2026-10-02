import { buildDashboard, type Dashboard } from '../dashboard/dashboards.ts';

/**
 * The dashboard library, mocked in the browser until there is a backend. The shapes here are the
 * contract the server is expected to serve (docs/product/dashboards.md):
 *
 *   GET  /library            → LibraryEntry[]   community dashboards, most added first
 *   POST /library            ← Dashboard        publish one of mine, → LibraryEntry
 *   DELETE /library/:id                         unpublish
 *   GET  /me                 → Account | 401
 *   GET  /me/dashboards      → Dashboard[]      PUT the same list to sync
 */
export type LibraryEntry = {
	id: string;
	author: string;
	description: string;
	tags: readonly string[];
	/** How many viewers added it. */
	adds: number;
	dashboard: Dashboard;
};

export type Account = { name: string; handle: string };

/** Made-up handles: these stand in for viewers who would share their screens. */
export const COMMUNITY: readonly LibraryEntry[] = [
	{
		id: 'second-screen',
		author: 'boxboxbox',
		description: 'For a laptop next to the TV: the order, the gaps around your driver, the flags.',
		tags: ['Laptop', 'Race day'],
		adds: 4812,
		dashboard: buildDashboard('second-screen', 'Second screen', [
			['replay', 0, 0, 8, 3],
			['lap-strip', 8, 0, 16, 3],
			['timing', 0, 3, 14, 22],
			['gaps', 14, 3, 10, 8],
			['race-control', 14, 11, 10, 14]
		])
	},
	{
		id: 'tv-wall',
		author: 'pitlanecam',
		description: 'Stretches to any height. Built on a 4K TV, reads from the sofa at text size TV.',
		tags: ['TV', 'Fit to screen'],
		adds: 3120,
		dashboard: buildDashboard(
			'tv-wall',
			'TV wall',
			[
				['timing', 0, 0, 9, 24],
				['chart', 9, 0, 9, 12, { metric: 'gap' }],
				['chart', 9, 12, 9, 12, { metric: 'position' }],
				['driver', 18, 0, 6, 14],
				['race-control', 18, 14, 6, 10]
			],
			{ fit: true }
		)
	},
	{
		id: 'undercut-watch',
		author: 'stintlength',
		description: 'Who can undercut whom: tyre wear, the stint map and where a stop rejoins.',
		tags: ['Strategy'],
		adds: 2264,
		dashboard: buildDashboard('undercut-watch', 'Undercut watch', [
			['replay', 0, 0, 6, 3],
			['lap-strip', 6, 0, 18, 3],
			['stints', 0, 3, 16, 14],
			['box-now', 16, 3, 8, 7],
			['gaps', 16, 10, 8, 7],
			['degradation', 0, 17, 24, 12]
		])
	},
	{
		id: 'teammates',
		author: 'dirtyair',
		description: 'Two cars, every lap: pick a pair in Compare and watch the gap swing.',
		tags: ['Analysis'],
		adds: 1907,
		dashboard: buildDashboard('teammates', 'Teammates', [
			['compare', 0, 0, 4, 24],
			['chart', 4, 0, 10, 12, { metric: 'battle' }],
			['chart', 14, 0, 10, 12, { metric: 'lapTime' }],
			['pace', 4, 12, 10, 12],
			['fastest-laps', 14, 12, 10, 12]
		])
	},
	{
		id: 'just-the-order',
		author: 'lightsout',
		description: 'Nothing else. The masthead, the running order and the weather.',
		tags: ['Minimal', 'Phone'],
		adds: 1544,
		dashboard: buildDashboard('just-the-order', 'Just the order', [
			['session', 0, 0, 24, 3],
			['timing', 0, 3, 18, 23],
			['weather', 18, 3, 6, 5]
		])
	},
	{
		id: 'driver-wall',
		author: 'gravelpit',
		description: 'The grid as pictures, the driver you follow large, positions lap by lap.',
		tags: ['Drivers'],
		adds: 1311,
		dashboard: buildDashboard('driver-wall', 'Driver wall', [
			['grid', 0, 0, 16, 16],
			['driver', 16, 0, 8, 16],
			['chart', 0, 16, 24, 12, { metric: 'position' }]
		])
	}
];
