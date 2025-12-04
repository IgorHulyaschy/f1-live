import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Layout from './components/ui/Layout';
import AnalyticsPage from './pages/AnalyticsPage';
import Home from './pages/Home';
import SimpleLive from './pages/SimpleLive';

function App() {
	return (
		<BrowserRouter>
			<Layout>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/simple-live" element={<SimpleLive />} />
					<Route path="/graphics" element={<AnalyticsPage />} />
				</Routes>
			</Layout>
		</BrowserRouter>
	);
}

export default App;
