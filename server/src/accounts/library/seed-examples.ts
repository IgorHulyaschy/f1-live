import type { Dashboard } from '@f1-live/shared/dashboard';

/**
 * Example dashboards the library starts with, so it is never empty. They belong to no account and
 * are shown as examples, not as a fan's work; they come from the layouts the app used to mock.
 */
export const SEED_EXAMPLES: readonly {
	id: string;
	name: string;
	description: string;
	tags: readonly string[];
	dashboard: Dashboard;
}[] = [
	{
		id: 'second-screen',
		description: 'For a laptop next to the TV: the order, the gaps around your driver, the flags.',
		tags: ['Laptop', 'Race day'],
		dashboard: {
			id: 'second-screen',
			name: 'Second screen',
			tiles: [
				{ id: 'second-screen-0', kind: 'replay' },
				{ id: 'second-screen-1', kind: 'lap-strip' },
				{ id: 'second-screen-2', kind: 'timing' },
				{ id: 'second-screen-3', kind: 'gaps' },
				{ id: 'second-screen-4', kind: 'race-control' }
			],
			layout: [
				{ i: 'second-screen-0', x: 0, y: 0, w: 8, h: 3 },
				{ i: 'second-screen-1', x: 8, y: 0, w: 16, h: 3 },
				{ i: 'second-screen-2', x: 0, y: 3, w: 14, h: 22 },
				{ i: 'second-screen-3', x: 14, y: 3, w: 10, h: 8 },
				{ i: 'second-screen-4', x: 14, y: 11, w: 10, h: 14 }
			]
		},
		name: 'Second screen'
	},
	{
		id: 'tv-wall',
		description: 'Stretches to any height. Built on a 4K TV, reads from the sofa at text size TV.',
		tags: ['TV', 'Fit to screen'],
		dashboard: {
			fit: true,
			id: 'tv-wall',
			name: 'TV wall',
			tiles: [
				{ id: 'tv-wall-0', kind: 'timing' },
				{ id: 'tv-wall-1', kind: 'chart', settings: { metric: 'gap' } },
				{ id: 'tv-wall-2', kind: 'chart', settings: { metric: 'position' } },
				{ id: 'tv-wall-3', kind: 'driver' },
				{ id: 'tv-wall-4', kind: 'race-control' }
			],
			layout: [
				{ i: 'tv-wall-0', x: 0, y: 0, w: 9, h: 24 },
				{ i: 'tv-wall-1', x: 9, y: 0, w: 9, h: 12 },
				{ i: 'tv-wall-2', x: 9, y: 12, w: 9, h: 12 },
				{ i: 'tv-wall-3', x: 18, y: 0, w: 6, h: 14 },
				{ i: 'tv-wall-4', x: 18, y: 14, w: 6, h: 10 }
			]
		},
		name: 'TV wall'
	},
	{
		id: 'undercut-watch',
		description: 'Who can undercut whom: tyre wear, the stint map and where a stop rejoins.',
		tags: ['Strategy'],
		dashboard: {
			id: 'undercut-watch',
			name: 'Undercut watch',
			tiles: [
				{ id: 'undercut-watch-0', kind: 'replay' },
				{ id: 'undercut-watch-1', kind: 'lap-strip' },
				{ id: 'undercut-watch-2', kind: 'stints' },
				{ id: 'undercut-watch-3', kind: 'box-now' },
				{ id: 'undercut-watch-4', kind: 'gaps' },
				{ id: 'undercut-watch-5', kind: 'degradation' }
			],
			layout: [
				{ i: 'undercut-watch-0', x: 0, y: 0, w: 6, h: 3 },
				{ i: 'undercut-watch-1', x: 6, y: 0, w: 18, h: 3 },
				{ i: 'undercut-watch-2', x: 0, y: 3, w: 16, h: 14 },
				{ i: 'undercut-watch-3', x: 16, y: 3, w: 8, h: 7 },
				{ i: 'undercut-watch-4', x: 16, y: 10, w: 8, h: 7 },
				{ i: 'undercut-watch-5', x: 0, y: 17, w: 24, h: 12 }
			]
		},
		name: 'Undercut watch'
	},
	{
		id: 'teammates',
		description: 'Two cars, every lap: pick a pair in Compare and watch the gap swing.',
		tags: ['Analysis'],
		dashboard: {
			id: 'teammates',
			name: 'Teammates',
			tiles: [
				{ id: 'teammates-0', kind: 'compare' },
				{ id: 'teammates-1', kind: 'chart', settings: { metric: 'battle' } },
				{ id: 'teammates-2', kind: 'chart', settings: { metric: 'lapTime' } },
				{ id: 'teammates-3', kind: 'pace' },
				{ id: 'teammates-4', kind: 'fastest-laps' }
			],
			layout: [
				{ i: 'teammates-0', x: 0, y: 0, w: 4, h: 24 },
				{ i: 'teammates-1', x: 4, y: 0, w: 10, h: 12 },
				{ i: 'teammates-2', x: 14, y: 0, w: 10, h: 12 },
				{ i: 'teammates-3', x: 4, y: 12, w: 10, h: 12 },
				{ i: 'teammates-4', x: 14, y: 12, w: 10, h: 12 }
			]
		},
		name: 'Teammates'
	},
	{
		id: 'just-the-order',
		description: 'Nothing else. The masthead, the running order and the weather.',
		tags: ['Minimal', 'Phone'],
		dashboard: {
			id: 'just-the-order',
			name: 'Just the order',
			tiles: [
				{ id: 'just-the-order-0', kind: 'session' },
				{ id: 'just-the-order-1', kind: 'timing' },
				{ id: 'just-the-order-2', kind: 'weather' }
			],
			layout: [
				{ i: 'just-the-order-0', x: 0, y: 0, w: 24, h: 3 },
				{ i: 'just-the-order-1', x: 0, y: 3, w: 18, h: 23 },
				{ i: 'just-the-order-2', x: 18, y: 3, w: 6, h: 5 }
			]
		},
		name: 'Just the order'
	},
	{
		id: 'driver-wall',
		description: 'The grid as pictures, the driver you follow large, positions lap by lap.',
		tags: ['Drivers'],
		dashboard: {
			id: 'driver-wall',
			name: 'Driver wall',
			tiles: [
				{ id: 'driver-wall-0', kind: 'grid' },
				{ id: 'driver-wall-1', kind: 'driver' },
				{ id: 'driver-wall-2', kind: 'chart', settings: { metric: 'position' } }
			],
			layout: [
				{ i: 'driver-wall-0', x: 0, y: 0, w: 16, h: 16 },
				{ i: 'driver-wall-1', x: 16, y: 0, w: 8, h: 16 },
				{ i: 'driver-wall-2', x: 0, y: 16, w: 24, h: 12 }
			]
		},
		name: 'Driver wall'
	}
];
