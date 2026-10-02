import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

import 'react-grid-layout/css/styles.css';
import './index.css';

import { AppLayout, LoadingState } from './app';
import { createRaceSource, raceSourceKindFromEnv } from './data/race-source';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { LibraryEntryPage, LibraryPage, SharedPage } from './features/library/library-page';
import { WelcomePage } from './features/library/welcome';
import { restoreScale } from './hooks/use-scale';
import { restoreTheme } from './hooks/use-theme';

restoreTheme();

restoreScale();

const source = createRaceSource(
	raceSourceKindFromEnv(import.meta.env.VITE_DATA_SOURCE),
	import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
);

const router = createBrowserRouter([
	{
		element: <AppLayout source={source} />,
		hydrateFallbackElement: <LoadingState />,
		children: [
			{ path: '/', element: <DashboardPage id="live" /> },
			{ path: '/analysis', element: <DashboardPage id="analysis" /> },
			{ path: '/strategy', element: <DashboardPage id="strategy" /> },
			{ path: '/d/:id', element: <DashboardPage /> },
			{ path: '/library', element: <LibraryPage /> },
			{ path: '/library/:entryId', element: <LibraryEntryPage /> },
			{ path: '/shared', element: <SharedPage /> },
			{ path: '/welcome', element: <WelcomePage /> }
		]
	},
	{
		element: <AppLayout source={source} bare />,
		hydrateFallbackElement: <LoadingState />,
		children: [
			{
				path: '/tile/:dashboardId/:tileId',
				lazy: async () => ({
					Component: (await import('./features/dashboard/tile-page')).TilePage
				})
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
		<RouterProvider router={router} />
	</StrictMode>
);
