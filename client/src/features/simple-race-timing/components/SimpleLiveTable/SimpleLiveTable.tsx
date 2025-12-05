import styles from './SimpleLiveTable.module.css';
import { useSessionData } from '../../hooks/useSessionData';

import type { Driver, Lap } from '../../types';
import { formatLapTime, formatSectorTime } from '@/features/race-timing/utils';

interface DriverWithLatestLap extends Driver {
	laps: Lap[];
	latestLap?: Lap;
	totalLaps: number;
}

export default function SimpleLiveTable() {
	const { data, isLoading, error } = useSessionData({
		enabled: false,
		refetchInterval: 1000 // Refresh every 5 seconds
	});

	// useLiveRaceUpdatesSimple();

	if (isLoading) {
		return (
			<div className={styles.container}>
				<div className={styles.content}>
					<div className={styles.tableWrapper}>
						<div className={styles.titleBar}>
							<div className={styles.titleLeft}>
								<span className={styles.titleText}>Loading Session Data...</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={styles.container}>
				<div className={styles.content}>
					<div className={styles.tableWrapper}>
						<div className={styles.titleBar}>
							<div className={styles.titleLeft}>
								<span className={styles.titleText}>Error Loading Data</span>
							</div>
						</div>
						<div className={styles.emptyState}>
							<p className={styles.emptyStateTitle}>Failed to load session data</p>
							<p className={styles.emptyStateText}>{error.message}</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className={styles.container}>
				<div className={styles.content}>
					<div className={styles.tableWrapper}>
						<div className={styles.titleBar}>
							<div className={styles.titleLeft}>
								<span className={styles.titleText}>No Data Available</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Process drivers with their latest lap
	const driversWithLatestLap: DriverWithLatestLap[] = data.driversLapsData.map((driverData) => {
		const latestCompletedLap = driverData.laps.find((lap) => !!lap.time);

		const driver: DriverWithLatestLap = {
			id: driverData.id,
			name: driverData.name,
			number: driverData.number,
			team: driverData.team,
			shortName: driverData.shortName,
			avatarUrl: driverData.avatarUrl,
			laps: driverData.laps,
			latestLap: latestCompletedLap,
			totalLaps: driverData.laps.length
		};

		return driver;
	});

	// Sort by lap number (most laps first) and then by latest lap time
	const sortedDrivers = driversWithLatestLap.sort((a, b) => {
		if (a.totalLaps !== b.totalLaps) {
			return b.totalLaps - a.totalLaps;
		}

		const aTime = a.latestLap?.time ?? Infinity;
		const bTime = b.latestLap?.time ?? Infinity;

		return aTime - bTime;
	});

	return (
		<div className={styles.container}>
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
			<link
				href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
				rel="stylesheet"
			/>

			<div className={styles.content}>
				<div className={styles.tableWrapper}>
					{/* Title Bar */}
					<div className={styles.titleBar}>
						<div className={styles.titleLeft}>
							<span className={styles.liveBadge}>
								<span className={styles.liveDot} />
								LIVE
							</span>
							<span className={styles.titleText}>
								{data.session.name} - {data.session.country}
							</span>
						</div>
						<div className={styles.sessionInfo}>{data.session.type.toUpperCase()}</div>
					</div>

					{/* Table */}
					<table className={styles.table}>
						<thead>
							<tr className={styles.tableHead}>
								<th className={styles.headerCellCenter}>Pos</th>
								<th className={styles.headerCell}>Driver</th>
								<th className={styles.headerCellCenter}>Laps</th>
								<th className={styles.headerCellCenter}>Last Lap</th>
								<th className={styles.headerCellCenter}>Sector 1</th>
								<th className={styles.headerCellCenter}>Sector 2</th>
								<th className={styles.headerCellCenter}>Sector 3</th>
							</tr>
						</thead>
						<tbody>
							{sortedDrivers.length === 0 ? (
								<tr>
									<td colSpan={7}>
										<div className={styles.emptyState}>
											<p className={styles.emptyStateTitle}>No driver data</p>
											<p className={styles.emptyStateText}>
												Waiting for lap data...
											</p>
										</div>
									</td>
								</tr>
							) : (
								sortedDrivers.map((driver, index) => (
									<tr key={driver.id} className={styles.row}>
										<td className={styles.cellCenter}>
											<span className={styles.driverNumber}>{index + 1}</span>
										</td>
										<td className={styles.cell}>
											<div className={styles.driverInfo}>
												<span className={styles.driverNumber}>
													{driver.number}
												</span>
												<div className={styles.driverDetails}>
													<span className={styles.driverName}>
														{driver.shortName}
													</span>
													<span className={styles.driverTeam}>
														{driver.team}
													</span>
												</div>
											</div>
										</td>
										<td className={styles.cellCenter}>
											<span className={styles.lapCount}>
												{driver.totalLaps}
											</span>
										</td>
										<td className={styles.cellCenter}>
											<span className={styles.time}>
												{formatLapTime(driver.latestLap?.time)}
											</span>
										</td>
										<td className={styles.cellCenter}>
											<span className={styles.sectorTime}>
												{formatSectorTime(driver.latestLap?.sector1Time)}
											</span>
										</td>
										<td className={styles.cellCenter}>
											<span className={styles.sectorTime}>
												{formatSectorTime(driver.latestLap?.sector2Time)}
											</span>
										</td>
										<td className={styles.cellCenter}>
											<span className={styles.sectorTime}>
												{formatSectorTime(driver.latestLap?.sector3Time)}
											</span>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
