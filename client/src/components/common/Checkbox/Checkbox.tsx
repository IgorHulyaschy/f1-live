import styles from './Checkbox.module.css';

interface CheckboxProps {
	checked: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
	onClick?: React.MouseEventHandler<HTMLInputElement> | undefined;
}

export default function Checkbox({
	checked,
	onChange,
	disabled = false,
	className = '',
	onClick
}: CheckboxProps) {
	return (
		<label className={`${styles.checkboxWrapper} ${className}`}>
			<input
				type="checkbox"
				className={styles.checkboxInput}
				checked={checked}
				onChange={(e) => onChange?.(e.target.checked)}
				disabled={disabled}
				onClick={onClick}
			/>
			<span className={styles.checkboxCustom}>
				<span className={styles.checkmark}>✓</span>
			</span>
		</label>
	);
}
