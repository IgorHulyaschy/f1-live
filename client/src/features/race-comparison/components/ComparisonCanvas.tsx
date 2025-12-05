import styles from './ComparisonCanvas.module.css';
import ComparisonChart from './ComparisonChart';

import type { ComparisonChart as ChartType, ChartPosition, ChartSize } from '../types';
import type { Driver } from '@f1-live/shared';

interface ComparisonCanvasProps {
	charts: ChartType[];
	drivers: Driver[];
	onChartMove: (chartId: string, position: ChartPosition) => void;
	onChartResize: (chartId: string, size: ChartSize) => void;
	onChartRemove: (chartId: string) => void;
	onBringToFront: (chartId: string) => void;
}

export default function ComparisonCanvas({
	charts,
	drivers,
	onChartMove,
	onChartResize,
	onChartRemove,
	onBringToFront
}: ComparisonCanvasProps) {
	return (
		<div className={styles.canvas}>
			{charts.length === 0 && (
				<div className={styles.emptyState}>
					<h2>No comparison charts yet</h2>
					<p>Use the sidebar to create your first comparison chart</p>
				</div>
			)}

			{charts.slice(1).map((chart) => (
				<ComparisonChart
					key={chart.id}
					chart={chart}
					drivers={drivers}
					onMove={(position) => onChartMove(chart.id, position)}
					onResize={(size) => onChartResize(chart.id, size)}
					onRemove={() => onChartRemove(chart.id)}
					onBringToFront={() => onBringToFront(chart.id)}
				/>
			))}
		</div>
	);
}
