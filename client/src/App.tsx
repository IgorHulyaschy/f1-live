import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Layout from './components/ui/Layout';
import AnalyticsPage from './pages/AnalyticsPage';
import Home from './pages/Home';
import RaceComparisonPage from './pages/RaceComparisonPage';
import SimpleLive from './pages/SimpleLive';

function App() {
	return (
		<BrowserRouter>
			<Layout>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/simple-live" element={<SimpleLive />} />
					<Route path="/graphics" element={<AnalyticsPage />} />
					<Route path="/comparison" element={<RaceComparisonPage />} />
				</Routes>
			</Layout>
		</BrowserRouter>
	);
}

export default App;
