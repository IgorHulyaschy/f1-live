import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, isRouteErrorResponse, RouterProvider } from 'react-router';

import './index.css';

import { AppLayout, Root, SiteLayout } from './app';
import { LoadingState } from './components/site-frame';
import { createRaceSource, raceSourceKindFromEnv } from './data/race-source';
import { HomeRoute } from './features/home/home-page';
import { WelcomePage } from './features/library/welcome';
import { restoreScale } from './hooks/use-scale';
import { restoreTheme } from './hooks/use-theme';
import type { LegalSlug } from './legal/content';
import { ErrorScreen } from './platform/error-screen';
import { consoleReporter, reportUncaughtErrors, silentReporter } from './platform/errors';
import { listenForInstallOffer, registerServiceWorker } from './platform/install';
import type { RouteHandle } from './platform/page-meta';
import { ROUTE_META, type RouteMeta } from './platform/route-meta';

restoreTheme();

restoreScale();

listenForInstallOffer();

// Owner item: an error reporting provider. Until one is chosen, development builds print reports.
const reporter = import.meta.env.DEV ? consoleReporter : silentReporter;

reportUncaughtErrors(window, reporter);

const source = createRaceSource(raceSourceKindFromEnv(import.meta.env.VITE_DATA_SOURCE), {
	apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
	liveUrl: import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/live'
});

function handle(meta: RouteMeta): RouteHandle {
	return { meta };
}

/** Dashboards carry the grid and every tile; the home and the library open without them. */
function dashboard(path: string, meta: RouteMeta, id?: string) {
	return {
		path,
		handle: handle(meta),
		lazy: async () => {
			const { DashboardPage } = await import('./features/dashboard/dashboard-page');

			return { element: <DashboardPage id={id} /> };
		}
	};
}

/** The library previews dashboards, so it loads with them. */
function library(
	path: string,
	meta: RouteMeta,
	page: 'LibraryPage' | 'LibraryEntryPage' | 'SharedPage'
) {
	return {
		path,
		handle: handle(meta),
		lazy: async () => ({ Component: (await import('./features/library/library-page'))[page] })
	};
}

function legal(slug: LegalSlug) {
	return {
		path: `/legal/${slug}`,
		lazy: async () => (await import('./legal/legal-page')).legalRoute(slug)
	};
}

const router = createBrowserRouter([
	{
		element: <Root />,
		ErrorBoundary: ErrorScreen,
		hydrateFallbackElement: <LoadingState label="Loading" />,
		children: [
			{
				element: <AppLayout source={source} />,
				children: [
					{ path: '/', element: <HomeRoute />, handle: handle(ROUTE_META.home) },
					dashboard('/session', ROUTE_META.session),
					dashboard('/analysis', ROUTE_META.analysis, 'analysis'),
					dashboard('/strategy', ROUTE_META.strategy, 'strategy'),
					dashboard('/d/:id', ROUTE_META.dashboard),
					library('/library', ROUTE_META.library, 'LibraryPage'),
					library('/library/:entryId', ROUTE_META.libraryEntry, 'LibraryEntryPage'),
					library('/shared', ROUTE_META.shared, 'SharedPage'),
					{ path: '/welcome', element: <WelcomePage />, handle: handle(ROUTE_META.welcome) },
					{
						path: '/account',
						handle: handle(ROUTE_META.account),
						lazy: async () => ({
							Component: (await import('./features/account/account-page')).AccountPage
						})
					},
					{
						path: '/calendar',
						handle: handle(ROUTE_META.calendar),
						lazy: async () => ({
							Component: (await import('./features/history/calendar-page')).CalendarPage
						})
					},
					{
						path: '/standings',
						handle: handle(ROUTE_META.standings),
						lazy: async () => ({
							Component: (await import('./features/history/standings-page')).StandingsPage
						})
					},
					{
						path: '/h2h',
						handle: handle(ROUTE_META.headToHead),
						lazy: async () => ({
							Component: (await import('./features/history/h2h-page')).HeadToHeadPage
						})
					},
					{
						path: '/drivers/:id',
						handle: handle(ROUTE_META.driver),
						lazy: async () => ({
							Component: (await import('./features/history/driver-page')).DriverPage
						})
					},
					{
						path: '/alerts',
						handle: handle(ROUTE_META.alerts),
						lazy: async () => ({
							Component: (await import('./features/alerts/alerts-page')).AlertsPage
						})
					}
				]
			},
			{
				element: <AppLayout source={source} bare />,
				children: [
					{
						path: '/tile/:dashboardId/:tileId',
						handle: handle(ROUTE_META.tile),
						lazy: async () => ({
							Component: (await import('./features/dashboard/tile-page')).TilePage
						})
					}
				]
			},
			{
				element: <SiteLayout />,
				children: [legal('terms'), legal('privacy'), legal('cookies')]
			}
		]
	}
]);

const root = document.getElementById('root');

if (!root) {
	throw new Error('Missing #root element');
}

createRoot(root).render(
	<StrictMode>
		<RouterProvider
			router={router}
			onError={(cause, { location }) => {
				// A missing page is an answer, not a fault.
				if (!isRouteErrorResponse(cause)) {
					reporter.capture(cause, { source: 'render', path: location.pathname });
				}
			}}
		/>
	</StrictMode>
);

registerServiceWorker();
