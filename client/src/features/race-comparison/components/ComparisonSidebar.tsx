import { DATA_TYPE_OPTIONS, TEAM_COLORS } from '../constants';
import styles from './ComparisonSidebar.module.css';

import type { DataType } from '../types';
import Checkbox from '@/components/common/Checkbox';
import Select from '@/components/common/Select';
import type { Driver } from '@f1-live/shared';

interface ComparisonSidebarProps {
	isOpen: boolean;
	onToggle: () => void;
	drivers: Driver[];
	selectedDriverNumbers: string[];
	onDriversChange: (driverNumbers: Driver['number'][]) => void;
	selectedDataType: DataType;
	onDataTypeChange: (dataType: DataType) => void;
	onCreateChart: () => void;
}

export default function ComparisonSidebar({
	isOpen,
	onToggle,
	drivers,
	selectedDriverNumbers,
	onDriversChange,
	selectedDataType,
	onDataTypeChange,
	onCreateChart
}: ComparisonSidebarProps) {
	const handleDriverToggle = (driverNumber: Driver['number']) => {
		if (selectedDriverNumbers.includes(driverNumber)) {
			onDriversChange(selectedDriverNumbers.filter((number) => number !== driverNumber));
		} else {
			onDriversChange([...selectedDriverNumbers, driverNumber]);
		}
	};

	const canCreate = selectedDriverNumbers.length >= 2;

	return (
		<div className={`${styles.sidebar} ${!isOpen ? styles.closed : ''}`}>
			<button
				className={styles.toggleButton}
				onClick={onToggle}
				title={isOpen ? 'Close sidebar' : 'Open sidebar'}
			>
				{isOpen ? '→' : '←'}
			</button>

			<div className={styles.header}>
				<h2 className={styles.title}>Comparison Settings</h2>
				<button className={styles.closeButton} onClick={onToggle}>
					×
				</button>
			</div>

			<div className={styles.content}>
				<div className={styles.section}>
					<div className={styles.sectionTitle}>Select Drivers</div>
					<div className={styles.driverList}>
						{drivers.map((driver) => (
							<div
								key={driver.number}
								className={`${styles.driverItem} ${
									selectedDriverNumbers.includes(driver.number)
										? styles.selected
										: ''
								}`}
								onClick={() => handleDriverToggle(driver.number)}
							>
								<Checkbox
									checked={selectedDriverNumbers.includes(driver.number)}
									onChange={() => {}}
									onClick={(e) => e.stopPropagation()}
								/>
								<div
									className={styles.teamColor}
									style={{
										backgroundColor:
											TEAM_COLORS[driver.team] || TEAM_COLORS['Haas']
									}}
								/>
								<div className={styles.driverInfo}>
									<p className={styles.driverName}>{driver.name}</p>
									<p className={styles.driverNumber}>#{driver.number}</p>
								</div>
							</div>
						))}
					</div>
					<div className={styles.selectionInfo}>
						{selectedDriverNumbers.length} driver
						{selectedDriverNumbers.length !== 1 ? 's' : ''} selected (minimum 2
						required)
					</div>
				</div>

				<div className={styles.section}>
					<div className={styles.sectionTitle}>Data Type</div>
					<Select
						value={selectedDataType}
						onChange={onDataTypeChange}
						options={DATA_TYPE_OPTIONS}
					/>
				</div>

				<button
					className={styles.createButton}
					onClick={onCreateChart}
					disabled={!canCreate}
					title={!canCreate ? 'Select at least 2 drivers' : 'Create comparison chart'}
				>
					Create Chart
				</button>
			</div>
		</div>
	);
}
