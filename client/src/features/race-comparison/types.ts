import type { Driver } from '@f1-live/shared';

export type DataType = 'lapTime' | 'sector1' | 'sector2' | 'sector3';

export interface ChartPosition {
	x: number;
	y: number;
}

export interface ChartSize {
	width: number;
	height: number;
}

export interface ComparisonChart {
	id: string;
	driverNumbers: Driver['number'][];
	dataType: DataType;
	position: ChartPosition;
	size: ChartSize;
	createdAt: number;
	zIndex: number;
}

export interface ChartDataPoint {
	lap: number;
	[key: string]: number | null; // driverId as key with lap time value
}

export interface ChartData {
	chartId: string;
	dataType: DataType;
	driverNumbers: Driver['number'][];
	points: ChartDataPoint[];
}

export interface LapTimeUpdate {
	driverId: string;
	lap: number;
	time: number;
	sector1: number;
	sector2: number;
	sector3: number;
}

export interface ComparisonState {
	charts: ComparisonChart[];
	sidebarOpen: boolean;
	selectedDriverNumbers: Driver['number'][];
	selectedDataType: DataType;
	nextZIndex: number;
}
