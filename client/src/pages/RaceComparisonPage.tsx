import { useState, useEffect, useRef } from 'react';

import {
	ComparisonCanvas,
	ComparisonSidebar,
	useComparisonCharts
} from '@/features/race-comparison';
import { useDrivers } from '@/features/race-comparison/hooks/useDrivers';
import type { DataType } from '@/features/race-comparison/types';
import type { Driver } from '@f1-live/shared';

// Mock drivers data - in real app, this would come from API
// const MOCK_DRIVERS: Driver[] = [
// 	{ id: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', number: 1, position: 1 },
// 	{ id: 'NOR', name: 'Lando Norris', team: 'McLaren', number: 4, position: 2 },
// 	{ id: 'LEC', name: 'Charles Leclerc', team: 'Ferrari', number: 16, position: 3 },
// 	{ id: 'PIA', name: 'Oscar Piastri', team: 'McLaren', number: 81, position: 4 },
// 	{ id: 'SAI', name: 'Carlos Sainz', team: 'Ferrari', number: 55, position: 5 },
// 	{ id: 'HAM', name: 'Lewis Hamilton', team: 'Mercedes', number: 44, position: 6 },
// 	{ id: 'RUS', name: 'George Russell', team: 'Mercedes', number: 63, position: 7 },
// 	{ id: 'PER', name: 'Sergio Perez', team: 'Red Bull Racing', number: 11, position: 8 }
// ];

export default function RaceComparisonPage() {
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [selectedDriverNumbers, setSelectedDriverNumbers] = useState<Driver['number'][]>([]);
	const [selectedDataType, setSelectedDataType] = useState<DataType>('lapTime');
	const canvasRef = useRef<HTMLDivElement>(null);

	const { data: drivers, isLoading: isDriversLoading } = useDrivers();
	const { charts, addChart, removeChart, updateChartPosition, updateChartSize, bringToFront } =
		useComparisonCharts();

	// Initialize with default chart showing top 2 drivers
	useEffect(() => {
		if (isDriversLoading) return;

		if (charts.length === 0 && canvasRef.current) {
			const canvasWidth = canvasRef.current.clientWidth;
			const canvasHeight = canvasRef.current.clientHeight;

			// Get top 2 drivers
			const top2Drivers = drivers.slice(0, 2).map((d) => d.number);

			// eslint-disable-next-line react-hooks/set-state-in-effect
			setSelectedDriverNumbers(top2Drivers);

			// Create default chart
			addChart(top2Drivers, 'lapTime', canvasWidth, canvasHeight);
		}
	}, [isDriversLoading]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleCreateChart = () => {
		if (selectedDriverNumbers.length < 2 || !canvasRef.current) return;

		const canvasWidth = canvasRef.current.clientWidth;
		const canvasHeight = canvasRef.current.clientHeight;

		addChart(selectedDriverNumbers, selectedDataType, canvasWidth, canvasHeight);
	};

	return (
		<div className="flex h-screen bg-[#0a0a0a]">
			<div ref={canvasRef} className="flex-1 relative">
				<ComparisonCanvas
					charts={charts}
					drivers={drivers}
					onChartMove={updateChartPosition}
					onChartResize={updateChartSize}
					onChartRemove={removeChart}
					onBringToFront={bringToFront}
				/>
			</div>
			<ComparisonSidebar
				isOpen={sidebarOpen}
				onToggle={() => setSidebarOpen(!sidebarOpen)}
				drivers={drivers}
				selectedDriverNumbers={selectedDriverNumbers}
				onDriversChange={setSelectedDriverNumbers}
				selectedDataType={selectedDataType}
				onDataTypeChange={setSelectedDataType}
				onCreateChart={handleCreateChart}
			/>
		</div>
	);
}
