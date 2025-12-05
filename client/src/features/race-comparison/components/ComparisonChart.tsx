import './ComparisonChart.css';
import { useRef } from 'react';
import Draggable, { type DraggableEvent, type DraggableData } from 'react-draggable';

import { LineChartPro } from '@mui/x-charts-pro/LineChartPro';
import { Resizable } from 're-resizable';

import {
	CHART_COLORS,
	DATA_TYPE_OPTIONS,
	MIN_CHART_SIZE,
	MAX_CHART_SIZE,
	TEAM_COLORS
} from '../constants';
import { useComparisonData } from '../hooks';
import { formatTime } from '../utils';
import styles from './ComparisonChart.module.css';
import { useRemoveMuiWatermark } from '../hooks/useRemoveMuiWatermark';

import type { ComparisonChart as ChartType, ChartPosition, ChartSize } from '../types';
import type { Driver } from '@f1-live/shared';

interface ComparisonChartProps {
	chart: ChartType;
	drivers: Driver[];
	onMove: (position: ChartPosition) => void;
	onResize: (size: ChartSize) => void;
	onRemove: () => void;
	onBringToFront: () => void;
}

export default function ComparisonChart({
	chart,
	drivers,
	onMove,
	onResize,
	onRemove,
	onBringToFront
}: ComparisonChartProps) {
	const nodeRef = useRef<HTMLDivElement>(null);
	const { data, isLoading } = useComparisonData({
		driversNumbers: chart.driverNumbers
	});

	useRemoveMuiWatermark(nodeRef);

	const handleDragStop = (_e: DraggableEvent, data: DraggableData) => {
		onMove({ x: data.x, y: data.y });
	};

	const handleResizeStop = (
		_e: MouseEvent | TouchEvent,
		_direction: unknown,
		_ref: HTMLElement,
		delta: { width: number; height: number }
	) => {
		onResize({
			width: chart.size.width + delta.width,
			height: chart.size.height + delta.height
		});
	};

	const handleMouseDown = () => {
		onBringToFront();
	};

	const chartTitle = `${DATA_TYPE_OPTIONS.find((opt) => opt.value === chart.dataType)?.label || chart.dataType} - ${chart.driverNumbers.map((n) => drivers.find((d) => d.number === n)?.name || n).join(' vs ')}`;

	// Get driver colors
	const getDriverColor = (driverNumber: Driver['number'], index: number): string => {
		const driver = drivers.find((d) => d.number === driverNumber);

		if (driver?.team && TEAM_COLORS[driver.team]) {
			return TEAM_COLORS[driver.team];
		}

		return CHART_COLORS[index % CHART_COLORS.length];
	};

	// Prepare series data for MUI X Charts
	const series = chart.driverNumbers.map((driverNumber, index) => {
		const driver = drivers.find((d) => d.number === driverNumber);

		return {
			dataKey: driverNumber,
			label: driver?.name || driverNumber,
			color: getDriverColor(driverNumber, index),
			showMark: true
		};
	});

	return (
		<Draggable
			nodeRef={nodeRef}
			handle=".drag-handle"
			position={{ x: chart.position.x, y: chart.position.y }}
			onStop={handleDragStop}
			bounds="parent"
		>
			<div ref={nodeRef} style={{ zIndex: chart.zIndex }}>
				<Resizable
					size={{ width: chart.size.width, height: chart.size.height }}
					minWidth={MIN_CHART_SIZE.width}
					minHeight={MIN_CHART_SIZE.height}
					maxWidth={MAX_CHART_SIZE.width}
					maxHeight={MAX_CHART_SIZE.height}
					onResizeStop={handleResizeStop}
					enable={{
						top: false,
						right: true,
						bottom: true,
						left: false,
						topRight: false,
						bottomRight: true,
						bottomLeft: false,
						topLeft: false
					}}
				>
					<div className={styles.chartContainer} onMouseDown={handleMouseDown}>
						<div className={`${styles.chartHeader} drag-handle`}>
							<div className={styles.chartTitle}>{chartTitle}</div>
							<div className={styles.chartControls}>
								<button
									className={styles.removeButton}
									onClick={onRemove}
									title="Remove chart"
								>
									×
								</button>
							</div>
						</div>

						<div className={styles.chartContent}>
							{isLoading && (
								<div className={styles.loadingOverlay}>
									<div className={styles.spinner} />
								</div>
							)}

							{!isLoading && data.length === 0 && (
								<div className={styles.emptyState}>
									No data available. Waiting for lap updates...
								</div>
							)}

							{!isLoading && data.length > 0 && (
								<LineChartPro
									dataset={data}
									series={series}
									xAxis={[
										{
											dataKey: 'lap',
											label: 'Lap',
											valueFormatter: (value: number) => `Lap ${value}`,
											zoom: true
										}
									]}
									yAxis={[
										{
											label: 'Time (s)',
											valueFormatter: (value: number | null) =>
												value ? formatTime(value) : '',
											zoom: true
										}
									]}
									height={chart.size.height - 44}
									margin={{ left: 0, right: 20, top: 0, bottom: 50 }}
									grid={{ horizontal: true }}
									sx={{
										'& .MuiChartsAxis-line': {
											stroke: '#fff !important'
										},
										'& .MuiChartsAxis-tick': {
											stroke: '#fff !important'
										},
										'& .MuiChartsAxis-tickLabel': {
											fill: '#fff !important'
										},
										'& .MuiChartsGrid-line': {
											stroke: '#fff !important',
											strokeDasharray: '3 3 !important'
										},
										'& .MuiChartsLegend-label': {
											color: '#fff !important'
										},
										'& .MuiChartsAxis-label tspan': {
											fill: '#fff !important'
										}
									}}
									slotProps={{
										legend: {
											direction: 'horizontal',
											position: { vertical: 'top', horizontal: 'center' }
										}
									}}
								/>
							)}
						</div>
					</div>
				</Resizable>
			</div>
		</Draggable>
	);
}
