import { useState, useEffect, useCallback, useMemo } from 'react';

import { LayoutGroup } from 'framer-motion';

import { COLUMNS, HEADER_CONFIG, MOCKED_DATA } from './constants';
import Row from './Row';
import styles from './styles.module.css';
import Th from './Th';

export default function Table() {
	const [drivers, setDrivers] = useState(MOCKED_DATA);
	const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
	const [currentLap, setCurrentLap] = useState(45);
	const [isSimulating, setIsSimulating] = useState(false);

	useEffect(() => {
		const handleClick = () => setActiveDropdown(null);

		document.addEventListener('click', handleClick);

		return () => document.removeEventListener('click', handleClick);
	}, []);

	const simulateOvertake = useCallback(() => {
		setDrivers((prev) => {
			const newDrivers = [...prev];
			const idx = Math.floor(Math.random() * (newDrivers.length - 1)) + 1;
			const d1 = newDrivers.find((d) => d.position === idx);
			const d2 = newDrivers.find((d) => d.position === idx + 1);

			if (d1 && d2) {
				d1.position = idx + 1;
				d1.positionChange = -1;
				d2.position = idx;
				d2.positionChange = 1;
				newDrivers.forEach((d) => {
					if (d.id !== d1.id && d.id !== d2.id) d.positionChange = 0;
				});
			}

			return newDrivers;
		});
	}, []);

	useEffect(() => {
		if (!isSimulating) return;
		const interval = setInterval(() => {
			simulateOvertake();
			setCurrentLap((p) => Math.min(p + 1, 57));
		}, 2500);

		return () => clearInterval(interval);
	}, [isSimulating, simulateOvertake]);

	const sortedDrivers = useMemo(
		() => [...drivers].sort((a, b) => a.position - b.position),
		[drivers]
	);

	const totalWidth = Object.values(COLUMNS).reduce((sum, col) => sum + col.width, 0);

	return (
		<div className={styles.container}>
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
			<link
				href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
				rel="stylesheet"
			/>

			<div className={styles.content}>
				{/* Controls */}
				<div className={styles.controls}>
					<button onClick={simulateOvertake} className={styles.buttonSimulate}>
						Simulate Overtake
					</button>
					<button
						onClick={() => setIsSimulating(!isSimulating)}
						className={styles.buttonAutoSimulate}
						data-active={isSimulating}
					>
						{isSimulating ? '⏸ Stop' : '▶ Auto Simulate'}
					</button>
					<button
						onClick={() => {
							setDrivers(MOCKED_DATA);
							setCurrentLap(45);
						}}
						className={styles.buttonReset}
					>
						Reset
					</button>
				</div>

				{/* Table */}
				<div className={styles.tableWrapper}>
					{/* Title Bar */}
					<div className={styles.titleBar}>
						<div className={styles.titleLeft}>
							<span className={styles.liveBadge}>
								<span className={styles.liveDot} />
								LIVE
							</span>
							<span className={styles.titleText}>Race Standings</span>
						</div>
						<div className={styles.lapCounter}>
							LAP <span className={styles.lapCurrent}>{currentLap}</span> / 57
						</div>
					</div>

					{/* Scrollable Table Container */}
					<div className={styles.scrollContainer}>
						<LayoutGroup>
							<table className={styles.table} style={{ width: totalWidth }}>
								<thead>
									<tr className={styles.tableHead}>
										{HEADER_CONFIG.map((column) => (
											<Th key={column.key} config={column} />
										))}
									</tr>
								</thead>
								<tbody>
									{sortedDrivers.map((driver) => (
										<Row
											key={driver.id}
											driver={driver}
											onActionClick={setActiveDropdown}
											activeDropdown={activeDropdown}
										/>
									))}
								</tbody>
							</table>
						</LayoutGroup>
					</div>
				</div>

				{/* Legend */}
				<div className={styles.legend}>
					<span className={styles.legendItem}>
						<span className={styles.legendDotPurple} />
						Fastest Overall
					</span>
					<span className={styles.legendItem}>
						<span className={styles.legendDotGreen} />
						Personal Best
					</span>
					<span className="text-[#eab308]">● Slower Sector</span>
					<span className="text-[#22c55e]">↑ Gained Position</span>
					<span className="text-[#ef4444]">↓ Lost Position</span>
				</div>
			</div>
		</div>
	);
}
