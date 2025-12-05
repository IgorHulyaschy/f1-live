import { useState, useCallback } from 'react';

import { DEFAULT_CHART_SIZE } from '../constants';
import { getOffsetChartPosition } from '../utils';

import type { ComparisonChart, ChartPosition, ChartSize, DataType } from '../types';
import type { Driver } from '@f1-live/shared';

interface UseComparisonChartsReturn {
	charts: ComparisonChart[];
	addChart: (
		driverNumbers: Driver['number'][],
		dataType: DataType,
		canvasWidth: number,
		canvasHeight: number
	) => string;
	removeChart: (chartId: string) => void;
	updateChartPosition: (chartId: string, position: ChartPosition) => void;
	updateChartSize: (chartId: string, size: ChartSize) => void;
	bringToFront: (chartId: string) => void;
}

export function useComparisonCharts(): UseComparisonChartsReturn {
	const [charts, setCharts] = useState<ComparisonChart[]>([]);
	const [nextZIndex, setNextZIndex] = useState(1);

	const addChart = useCallback(
		(
			driverNumbers: Driver['number'][],
			dataType: DataType,
			canvasWidth: number,
			canvasHeight: number
		): string => {
			const id = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			const position = getOffsetChartPosition(charts.length, canvasWidth, canvasHeight);

			const newChart: ComparisonChart = {
				id,
				driverNumbers,
				dataType,
				position,
				size: { ...DEFAULT_CHART_SIZE },
				createdAt: Date.now(),
				zIndex: nextZIndex
			};

			setCharts((prev) => [...prev, newChart]);
			setNextZIndex((prev) => prev + 1);

			return id;
		},
		[charts.length, nextZIndex]
	);

	const removeChart = useCallback((chartId: string) => {
		setCharts((prev) => prev.filter((chart) => chart.id !== chartId));
	}, []);

	const updateChartPosition = useCallback((chartId: string, position: ChartPosition) => {
		setCharts((prev) =>
			prev.map((chart) => (chart.id === chartId ? { ...chart, position } : chart))
		);
	}, []);

	const updateChartSize = useCallback((chartId: string, size: ChartSize) => {
		setCharts((prev) =>
			prev.map((chart) => (chart.id === chartId ? { ...chart, size } : chart))
		);
	}, []);

	const bringToFront = useCallback((chartId: string) => {
		setNextZIndex((prev) => {
			const newZIndex = prev;

			setCharts((charts) =>
				charts.map((chart) =>
					chart.id === chartId ? { ...chart, zIndex: newZIndex } : chart
				)
			);

			return newZIndex + 1;
		});
	}, []);

	return {
		charts,
		addChart,
		removeChart,
		updateChartPosition,
		updateChartSize,
		bringToFront
	};
}
