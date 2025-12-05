import type { DataType } from './types';

export const DEFAULT_CHART_SIZE = {
	width: 700,
	height: 300
};

export const MIN_CHART_SIZE = {
	width: 300,
	height: 200
};

export const MAX_CHART_SIZE = {
	width: 1000,
	height: 600
};

export const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
	{ value: 'lapTime', label: 'Lap Time' },
	{ value: 'sector1', label: 'Sector 1' },
	{ value: 'sector2', label: 'Sector 2' },
	{ value: 'sector3', label: 'Sector 3' }
];

export const CHART_COLORS = [
	'#e10600', // F1 Red
	'#3671C6', // Blue
	'#FF8000', // Orange
	'#27F4D2', // Cyan
	'#22c55e', // Green
	'#a855f7', // Purple
	'#fbbf24', // Yellow
	'#FF87BC' // Pink
];

export const TEAM_COLORS: Record<string, string> = {
	'Red Bull Racing': '#3671C6',
	Ferrari: '#e10600',
	Mercedes: '#27F4D2',
	McLaren: '#FF8000',
	'Aston Martin': '#229971',
	Alpine: '#FF87BC',
	Williams: '#64C4FF',
	AlphaTauri: '#5E8FAA',
	'Alfa Romeo': '#C92D4B',
	Haas: '#B6BABD'
};
