import styles from './Select.module.css';

export interface SelectOption<T = string> {
	value: T;
	label: string;
}

interface SelectProps<T = string> {
	value: T;
	onChange: (value: T) => void;
	options: SelectOption<T>[];
	disabled?: boolean;
	className?: string;
	placeholder?: string;
}

export default function Select<T extends string = string>({
	value,
	onChange,
	options,
	disabled = false,
	className = '',
	placeholder
}: SelectProps<T>) {
	return (
		<select
			className={`${styles.select} ${className}`}
			value={value}
			onChange={(e) => onChange(e.target.value as T)}
			disabled={disabled}
		>
			{placeholder && (
				<option value="" disabled>
					{placeholder}
				</option>
			)}
			{options.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	);
}
