import styles from './TableHeader.module.css';

import type { ThProps } from '../../../types';

export default function TableHeader({ config }: ThProps) {
	const getClassName = () => {
		if (config.sticky === 'left') {
			return styles.stickyLeft;
		}

		if (config.sticky === 'right') {
			return styles.stickyRight;
		}

		return styles.headerCell;
	};

	const getStyle = () => {
		const style: React.CSSProperties = { width: config.width };

		if (config.sticky === 'left' && config.leftOffset !== undefined) {
			style.left = config.leftOffset;
		}

		return style;
	};

	return (
		<th className={getClassName()} style={getStyle()}>
			{config.label}
		</th>
	);
}
