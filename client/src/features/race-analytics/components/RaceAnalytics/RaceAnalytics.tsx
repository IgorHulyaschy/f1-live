import { useMemo } from 'react';

import { LineChartPro } from '@mui/x-charts-pro/LineChartPro';

import styles from './RaceAnalytics.module.css';

export default function RaceAnalytics() {
	// Generate realistic lap time data (in seconds) - deterministic for consistency
	const { laps, maxLapTimes, landoLapTimes, maxAvg, landoAvg, gapSeconds } = useMemo(() => {
		const lapsData = Array.from({ length: 20 }, (_, i) => i + 1);

		// Deterministic variations for realistic lap times
		const variations = [
			0.3, -0.2, 0.5, -0.4, 0.1, 0.6, -0.3, 0.2, -0.1, 0.4, -0.5, 0.3, 0.1, -0.2, 0.4, -0.1,
			0.2, 0.5, -0.3, 0.1
		];

		// Max's lap times - faster (around 88-90 seconds)
		const maxTimes = lapsData.map((lap, index) => {
			const basePace = 88.5;
			const variation = variations[index];
			const degradation = lap * 0.02;

			return +(basePace + variation + degradation).toFixed(3);
		});

		// Lando's lap times - slightly slower (around 89-91 seconds)
		const landoTimes = lapsData.map((lap, index) => {
			const basePace = 89.8;
			const variation = variations[index];
			const degradation = lap * 0.03;

			return +(basePace + variation + degradation).toFixed(3);
		});

		// Calculate average pace
		const maxAverage = (maxTimes.reduce((a, b) => a + b, 0) / maxTimes.length).toFixed(3);
		const landoAverage = (landoTimes.reduce((a, b) => a + b, 0) / landoTimes.length).toFixed(3);
		const gap = (parseFloat(landoAverage) - parseFloat(maxAverage)).toFixed(3);

		return {
			laps: lapsData,
			maxLapTimes: maxTimes,
			landoLapTimes: landoTimes,
			maxAvg: maxAverage,
			landoAvg: landoAverage,
			gapSeconds: gap
		};
	}, []);

	return (
		<div className={styles.container}>
			{/* Header */}
			<div className={styles.header}>
				<div className={styles.titleSection}>
					<h1 className={styles.title}>Race Tempo Analysis</h1>
					<div className={styles.liveBadge}>
						<span className={styles.liveDot} />
						LIVE
					</div>
				</div>
				<p className={styles.subtitle}>Lap Time Comparison - Monaco Grand Prix 2024</p>
			</div>

			{/* Stats Cards */}
			<div className={styles.statsGrid}>
				<div className={styles.statCard} data-winner="true">
					<div className={styles.statHeader}>
						<div className={styles.driverName}>Max Verstappen</div>
						<div className={styles.teamBadge} data-team="red-bull">
							Red Bull Racing
						</div>
					</div>
					<div className={styles.statValue}>{maxAvg}s</div>
					<div className={styles.statLabel}>Average Lap Time</div>
					<div className={styles.winnerBadge}>FASTER 🏆</div>
				</div>

				<div className={styles.statCard}>
					<div className={styles.statHeader}>
						<div className={styles.driverName}>Lando Norris</div>
						<div className={styles.teamBadge} data-team="mclaren">
							McLaren F1 Team
						</div>
					</div>
					<div className={styles.statValue}>{landoAvg}s</div>
					<div className={styles.statLabel}>Average Lap Time</div>
					<div className={styles.gapBadge}>+{gapSeconds}s behind</div>
				</div>
			</div>

			{/* Chart */}
			<div className={styles.chartContainer}>
				<div className={styles.chartHeader}>
					<h2 className={styles.chartTitle}>Lap Time Evolution</h2>
					<div className={styles.legend}>
						<span className={styles.legendItem}>
							<span className={styles.legendDot} data-color="blue" />
							Max Verstappen
						</span>
						<span className={styles.legendItem}>
							<span className={styles.legendDot} data-color="orange" />
							Lando Norris
						</span>
					</div>
				</div>

				<LineChartPro
					xAxis={[
						{
							data: laps,
							label: 'Lap Number',
							scaleType: 'linear',
							zoom: true
						}
					]}
					series={[
						{
							data: maxLapTimes,
							label: 'Max Verstappen',
							color: '#1e3a8a',
							curve: 'natural',
							showMark: true
						},
						{
							data: landoLapTimes,
							label: 'Lando Norris',
							color: '#ff8700',
							curve: 'natural',
							showMark: true
						}
					]}
					height={400}
					margin={{ top: 20, right: 20, bottom: 60, left: 80 }}
					sx={{
						'& .MuiLineElement-root': {
							strokeWidth: 3
						},
						'& .MuiMarkElement-root': {
							scale: '0.8',
							strokeWidth: 2
						},
						'& .MuiChartsAxis-tickLabel': {
							fill: '#888 !important',
							fontFamily: 'JetBrains Mono, monospace',
							fontSize: '0.75rem'
						},
						'& .MuiChartsAxis-label': {
							fill: '#fff !important',
							fontFamily: 'Outfit, sans-serif',
							fontWeight: 600,
							fontSize: '0.875rem'
						},
						'& .MuiChartsAxis-line': {
							stroke: 'rgba(255, 255, 255, 0.1)'
						},
						'& .MuiChartsAxis-tick': {
							stroke: 'rgba(255, 255, 255, 0.1)'
						},
						'& .MuiChartsGrid-line': {
							stroke: 'rgba(255, 255, 255, 0.05)'
						}
					}}
					yAxis={[
						{
							label: 'Lap Time (seconds)',
							scaleType: 'linear',
							zoom: true
						}
					]}
					grid={{ vertical: true, horizontal: true }}
				/>
			</div>

			{/* Analysis */}
			<div className={styles.analysis}>
				<h3 className={styles.analysisTitle}>📊 Race Analysis</h3>
				<div className={styles.analysisContent}>
					<p>
						<strong>Max Verstappen</strong> demonstrates superior race pace with an
						average lap time of <span className={styles.highlight}>{maxAvg}s</span>,
						consistently outperforming his rival.
					</p>
					<p>
						With better tire management and racecraft, Max maintains a{' '}
						<span className={styles.highlight}>{gapSeconds}s per lap advantage</span>{' '}
						over Lando Norris, positioning him for victory.
					</p>
					<p className={styles.verdict}>
						🏁 <strong>Verdict:</strong> Max Verstappen on course for another dominant
						win!
					</p>
				</div>
			</div>
		</div>
	);
}
