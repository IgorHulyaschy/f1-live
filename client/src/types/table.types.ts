export interface ColumnConfig {
	key: string;
	label: string;
	width: number;
	sticky?: 'left' | 'right';
	leftOffset?: number;
}

export interface ThProps {
	config: ColumnConfig;
}
