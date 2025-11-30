import { motion } from 'framer-motion';

import { TEAM_COLORS } from '../../../constants/team-colors.constants';
import { MoreVerticalIcon } from '../../Icons';
import ActionDropdown from '../ActionChange';
import { COLUMNS } from '../constants';
import PositionChange from '../PositionChange';
import positionStyles from './position.module.css';
import rowStyles from './row.module.css';
import sectorStyles from './sector.module.css';
import statusStyles from './status.module.css';
import styles from './styles.module.css';
import tireStyles from './tire.module.css';
import { getStatusLabel } from './utils';

import type { RowProps } from '../../../types/driver.types';

export default function Row({ driver, onActionClick, activeDropdown }: RowProps) {
	const teamColor = TEAM_COLORS[driver.team as keyof typeof TEAM_COLORS] || '#666';
	const isDropdownOpen = activeDropdown === driver.id;
	const positionChangeAttr =
		driver.positionChange > 0 ? 'up' : driver.positionChange < 0 ? 'down' : undefined;

	return (
		<motion.tr
			layout
			layoutId={driver.id}
			className={rowStyles.row}
			data-position-change={positionChangeAttr}
			transition={{ layout: { type: 'spring', stiffness: 400, damping: 35 } }}
		>
			{/* Sticky Left: Position */}
			<td className={styles.stickyLeft} style={{ width: COLUMNS.position.width }}>
				<div
					className={positionStyles.position}
					data-place={driver.position <= 3 ? driver.position : undefined}
				>
					{driver.position}
					<PositionChange change={driver.positionChange} />
				</div>
			</td>

			{/* Sticky Left: Driver */}
			<td
				className={styles.stickyLeft}
				style={{ width: COLUMNS.driver.width, left: COLUMNS.position.width }}
			>
				<div className={styles.driverInfo}>
					<div className={styles.colorBar} style={{ background: teamColor }} />
					<div className={styles.driverDetails}>
						<span className={styles.driverName}>{driver.name}</span>
						<span className={styles.teamName}>{driver.team}</span>
					</div>
				</div>
			</td>

			{/* Scrollable: Last Lap */}
			<td className={styles.cell} style={{ width: COLUMNS.lastLap.width }}>
				<div className={styles.monoText}>
					{driver.hasFastestLap && <div className={styles.fastestLapDot} />}
					{driver.lastLap}
				</div>
			</td>

			{/* Scrollable: Gap */}
			<td className={styles.cell} style={{ width: COLUMNS.gap.width }}>
				<div className={styles.monoGray}>
					{driver.gap}
					{driver.inDRS && <span className={styles.drsBadge}>DRS</span>}
				</div>
			</td>

			{/* Scrollable: Interval */}
			<td className={styles.cell} style={{ width: COLUMNS.interval.width }}>
				<span className={styles.monoGray}>{driver.interval}</span>
			</td>

			{/* Scrollable: Sectors */}
			<td
				className={sectorStyles.sector}
				data-status={driver.s1Status}
				style={{ width: COLUMNS.s1.width }}
			>
				{driver.s1}
			</td>
			<td
				className={sectorStyles.sector}
				data-status={driver.s2Status}
				style={{ width: COLUMNS.s2.width }}
			>
				{driver.s2}
			</td>
			<td
				className={sectorStyles.sector}
				data-status={driver.s3Status}
				style={{ width: COLUMNS.s3.width }}
			>
				{driver.s3}
			</td>

			{/* Scrollable: Tire */}
			<td className={styles.cell} style={{ width: COLUMNS.tire.width }}>
				<div className={styles.tireInfo}>
					<div className={tireStyles.tire} data-compound={driver.tire}>
						{driver.tire}
					</div>
					<span className={styles.tireAge}>L{driver.tireAge}</span>
				</div>
			</td>

			{/* Scrollable: Laps */}
			<td className={`${styles.cell} text-center`} style={{ width: COLUMNS.laps.width }}>
				<span className={styles.monoGray}>{driver.laps}</span>
			</td>

			{/* Scrollable: Status */}
			<td className={styles.cell} style={{ width: COLUMNS.status.width }}>
				<span className={statusStyles.status} data-status={driver.status}>
					{getStatusLabel(driver.status)}
				</span>
			</td>

			{/* Sticky Right: Actions */}
			<td className={styles.stickyRight} style={{ width: COLUMNS.actions.width }}>
				<button
					className={styles.actionButton}
					onClick={(e) => {
						e.stopPropagation();
						onActionClick(driver.id);
					}}
				>
					<MoreVerticalIcon />
				</button>

				<ActionDropdown isOpen={isDropdownOpen} />
			</td>
		</motion.tr>
	);
}
