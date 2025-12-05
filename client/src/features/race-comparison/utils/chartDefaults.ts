import { DEFAULT_CHART_SIZE } from '../constants';

import type { ChartPosition, ChartSize } from '../types';

export function getDefaultChartPosition(canvasWidth: number, canvasHeight: number): ChartPosition {
	// Center the chart on the canvas
	return {
		x: Math.max(0, (canvasWidth - DEFAULT_CHART_SIZE.width) / 2),
		y: Math.max(0, (canvasHeight - DEFAULT_CHART_SIZE.height) / 2)
	};
}

export function getOffsetChartPosition(
	existingChartsCount: number,
	canvasWidth: number,
	canvasHeight: number
): ChartPosition {
	// Offset each new chart slightly from the previous one
	const offset = (existingChartsCount % 5) * 40;
	const basePosition = getDefaultChartPosition(canvasWidth, canvasHeight);

	return {
		x: Math.min(basePosition.x + offset, canvasWidth - DEFAULT_CHART_SIZE.width),
		y: Math.min(basePosition.y + offset, canvasHeight - DEFAULT_CHART_SIZE.height)
	};
}

export function constrainPosition(
	position: ChartPosition,
	size: ChartSize,
	canvasWidth: number,
	canvasHeight: number
): ChartPosition {
	return {
		x: Math.max(0, Math.min(position.x, canvasWidth - size.width)),
		y: Math.max(0, Math.min(position.y, canvasHeight - size.height))
	};
}
