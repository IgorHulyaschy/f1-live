import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

import './index.css';

import { AppLayout } from './app';
import { createRaceSource, raceSourceKindFromEnv } from './data/race-source';
import { LivePage } from './pages/live-page';

const source = createRaceSource(
	raceSourceKindFromEnv(import.meta.env.VITE_DATA_SOURCE),
	import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
);

const router = createBrowserRouter([
	{
		element: <AppLayout source={source} />,
		children: [
			{ path: '/', element: <LivePage /> },
			{
				path: '/analysis',
				lazy: async () => ({ Component: (await import('./pages/analysis-page')).AnalysisPage })
			},
			{
				path: '/strategy',
				lazy: async () => ({ Component: (await import('./pages/strategy-page')).StrategyPage })
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
