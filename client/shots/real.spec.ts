import { expect, test } from '@playwright/test';

/**
 * Audit screenshots on real data (the e2e fixture: 2025 Las Vegas, 2026 Baku qualifying), at two
 * phones, a tablet, a laptop, a desktop and a 2560 px monitor, dark and light. Output goes to
 * shots/output/real/<viewport>/<page>-<theme>.png and is not committed.
 */

const VIEWPORTS = [
	{ name: 'android', width: 360, height: 800 },
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 834, height: 1194 },
	{ name: 'laptop', width: 1440, height: 900 },
	{ name: 'desktop', width: 1920, height: 1080 },
	{ name: 'qhd', width: 2560, height: 1440 }
] as const;

const PAGES = [
	// The session layouts: Quali in its first and second parts, Race, Practice.
	{ name: 'quali-q1', path: '/?session=11373&lap=12' },
	{ name: 'quali-q2', path: '/?session=11373&lap=33' },
	{ name: 'practice', path: '/?session=9852' },
	{ name: 'race-final', path: '/?session=9858' },
	{ name: 'race-lap-30', path: '/?session=9858&lap=30' },
	{ name: 'strategy', path: '/strategy?session=9858' },
	{ name: 'qualifying', path: '/?session=11373' },
	{ name: 'qualifying-q2', path: '/?session=9854&lap=40' },
	{ name: 'analysis-qualifying', path: '/analysis?session=9854' },
	{ name: 'battle-qualifying', path: '/d/battle?session=11373' },
	{ name: 'analysis-race', path: '/analysis?session=9858&plan=pro' },
	{ name: 'strategy-pro', path: '/strategy?session=9858&plan=pro' },
	{ name: 'race-story', path: '/d/story?session=9858&plan=pro' },
	{ name: 'story-qualifying', path: '/d/story?session=9854&plan=pro' },
	{ name: 'analysis-practice', path: '/analysis?session=9852&plan=pro' },
	{ name: 'track-race', path: '/d/track?session=9858&lap=30&plan=pro' },
	{ name: 'track-start', path: '/d/track?session=9858&lap=1&plan=pro' },
	{ name: 'track-qualifying', path: '/d/track?session=11373&plan=pro' },
	{ name: 'wall-race', path: '/d/wall?session=9858&lap=30' },
	// 2026 Bahrain qualifying: the gap tile in the Quali layout, the gap visuals, the quali charts.
	{ name: 'quali-bahrain', path: '/?session=11730&plan=pro' },
	{ name: 'track-bahrain', path: '/d/track?session=11730&plan=pro' },
	{ name: 'analysis-bahrain', path: '/analysis?session=11730' },
	// The history pages on the results index of 2018 to 2026.
	{ name: 'calendar', path: '/calendar?season=2026' },
	{ name: 'standings', path: '/standings?season=2025&round=11' },
	{ name: 'standings-teams', path: '/standings?season=2021&view=teams' },
	{ name: 'h2h', path: '/h2h?a=lando-norris&b=oscar-piastri&from=2023.1&to=2025.24' },
	{ name: 'h2h-hamilton-bottas', path: '/h2h?a=lewis-hamilton&b=valtteri-bottas&preset=teammates' },
	{ name: 'driver-history', path: '/drivers/lando-norris' },
	// Spoiler protection on a finished session the viewer has not seen.
	{ name: 'spoiler-start-quali', path: '/?session=11373', spoilers: true },
	{ name: 'spoiler-start-race', path: '/?session=9858', spoilers: true },
	// The driver, lap and compare views: a sheet over the dashboard, shot as the window shows it.
	{ name: 'driver-quali', path: '/?session=11373&car=63', sheet: true },
	{ name: 'driver-race', path: '/?session=9858&car=4&lap=30', sheet: true },
	{ name: 'lap-quali', path: '/?session=11373&car=63&carLap=26&vs=16', sheet: true },
	{ name: 'compare-race', path: '/?session=9858&car=1&vs=63', sheet: true },
	{ name: 'driver-hidden', path: '/?session=11373&car=63', spoilers: true, sheet: true }
] as const;

const THEMES = ['dark', 'light'] as const;

for (const viewport of VIEWPORTS) {
	test.describe(viewport.name, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });

		for (const screen of PAGES) {
			for (const theme of THEMES) {
				test(`${screen.name} ${theme}`, async ({ page }) => {
					await page.route('https://media.formula1.com/**', (route) => route.abort());
					await page.addInitScript(
						([chosen, spoilers]) => {
							window.localStorage.setItem('pitwall-welcomed', 'true');
							window.localStorage.setItem('pitwall-theme', chosen);
							// Most audit finished sessions as they ended; the spoiler shots keep protection on.
							window.localStorage.setItem('pitwall-spoiler-free', String(spoilers));
						},
						[theme, 'spoilers' in screen] as const
					);
					await page.goto(screen.path);
					await (/^\/(calendar|standings|h2h|drivers)/.test(screen.path)
						? expect(page.getByRole('heading', { level: 1 })).toBeVisible()
						: expect(page.getByTestId('lap-counter')).toBeAttached());
					// Heavy tiles below the first screen wait to be scrolled to; a print draws them all.
					await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
					// Telemetry and maps load after the session; wait for them so the charts are drawn.
					await page.waitForLoadState('networkidle');
					await page.evaluate(() => document.fonts.ready);
					await page.waitForTimeout(800);

					await page.screenshot({
						path: `shots/output/real/${viewport.name}/${screen.name}-${theme}.png`,
						fullPage: !('sheet' in screen),
						animations: 'disabled',
						style:
							'body { position: relative; } [data-pit-board] { position: absolute; bottom: 0; }'
					});
				});
			}
		}
	});
}
