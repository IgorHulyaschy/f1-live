import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import SimpleLive from './pages/SimpleLive';

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<SimpleLive />} />
				<Route path="/demo" element={<Home />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
