/**
 * Example: Table component with WebSocket live updates
 *
 * This example shows how to combine TanStack Query with WebSocket
 * for real-time race data updates.
 *
 * Features:
 * - Initial data fetch via REST API
 * - Live updates via WebSocket
 * - Automatic cache synchronization
 * - Connection status indicator
 */

import { useState, useEffect } from 'react';

import { LayoutGroup } from 'framer-motion';

import { COLUMNS, HEADER_CONFIG } from './constants';
import Row from './Row';
import styles from './styles.module.css';
import Th from './Th';
import { useLiveRaceUpdates } from '../../hooks/useLiveRaceUpdates';
import { useRaceSession } from '../../hooks/useRaceSession';

import type { ColumnConfig } from '../../types/table.types';

export default function Table() {
	const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

	// Fetch initial race session data
	const {
		data: session,
		isLoading,
		error
	} = useRaceSession({
		refetchInterval: false // Disable polling since we're using WebSocket
	});

	// Connect to WebSocket for live updates
	const { status: wsStatus, isConnected } = useLiveRaceUpdates({
		sessionId: session?.sessionId,
		enabled: !!session?.isLive // Only connect if session is live
	});

	useEffect(() => {
		const handleClick = () => setActiveDropdown(null);

		document.addEventListener('click', handleClick);

		return () => document.removeEventListener('click', handleClick);
	}, []);

	const totalWidth = Object.values(COLUMNS).reduce((sum, col) => sum + col.width, 0);

	// Loading state
	if (isLoading) {
		return (
			<div className={styles.container}>
				<div className={styles.content}>
					<div className={styles.tableWrapper}>
						<div className={styles.titleBar}>
							<div className={styles.titleLeft}>
								<span className={styles.titleText}>Loading Race Data...</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className={styles.container}>
				<div className={styles.content}>
					<div className={styles.tableWrapper}>
						<div className={styles.titleBar}>
							<div className={styles.titleLeft}>
								<span className={styles.titleText}>Error Loading Race Data</span>
							</div>
						</div>
						<div style={{ padding: '2rem', textAlign: 'center' }}>
							<p style={{ color: '#ef4444', marginBottom: '1rem' }}>
								{error.message}
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// No data state
	if (!session) {
		return (
			<div className={styles.container}>
				<div className={styles.content}>
					<div className={styles.tableWrapper}>
						<div className={styles.titleBar}>
							<div className={styles.titleLeft}>
								<span className={styles.titleText}>No Session Data</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const sortedDrivers = [...session.drivers].sort((a, b) => a.position - b.position);

	return (
		<div className={styles.container}>
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
			<link
				href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
				rel="stylesheet"
			/>

			<div className={styles.content}>
				{/* Table */}
				<div className={styles.tableWrapper}>
					{/* Title Bar */}
					<div className={styles.titleBar}>
						<div className={styles.titleLeft}>
							{session.isLive && (
								<span className={styles.liveBadge}>
									<span className={styles.liveDot} />
									LIVE
								</span>
							)}
							<span className={styles.titleText}>{session.sessionName}</span>

							{/* WebSocket Status Indicator */}
							{session.isLive && (
								<span
									style={{
										fontSize: '0.6875rem',
										marginLeft: '0.75rem',
										color: isConnected ? '#22c55e' : '#ef4444'
									}}
								>
									{wsStatus === 'connected' && '● Connected'}
									{wsStatus === 'connecting' && '○ Connecting...'}
									{wsStatus === 'disconnected' && '○ Disconnected'}
									{wsStatus === 'error' && '✕ Connection Error'}
								</span>
							)}
						</div>
						<div className={styles.lapCounter}>
							LAP <span className={styles.lapCurrent}>{session.currentLap}</span> /{' '}
							{session.totalLaps}
						</div>
					</div>

					{/* Scrollable Table Container */}
					<div className={styles.scrollContainer}>
						<LayoutGroup>
							<table className={styles.table} style={{ width: totalWidth }}>
								<thead>
									<tr className={styles.tableHead}>
										{HEADER_CONFIG.map((column: ColumnConfig) => (
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
