import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Hardware-style keys: square, labelled in mono caps, with a thicker bottom edge. A pressed key
 * fills solid. They replace pills, toggles and tabs across the app.
 */
export function Key({
	pressed = false,
	className,
	...props
}: React.ComponentProps<'button'> & { pressed?: boolean }) {
	return (
		<button
			type="button"
			className={cn(
				'type-label inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 border border-b-2 px-2 whitespace-nowrap sm:px-2.5 transition-colors select-none focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:outline-none disabled:cursor-default disabled:opacity-40 [&_svg]:size-3.5',
				pressed
					? 'border-foreground bg-foreground text-background'
					: 'hover:text-foreground hover:border-rule-strong',
				className
			)}
			{...props}
		/>
	);
}

/** A row of keys where exactly one is pressed. */
export function KeyGroup<Value extends string>({
	options,
	value,
	onChange,
	label,
	role = 'radiogroup'
}: {
	options: readonly { value: Value; label: React.ReactNode }[];
	value: Value;
	onChange: (value: Value) => void;
	label: string;
	role?: 'radiogroup' | 'tablist';
}) {
	return (
		<div role={role} aria-label={label} className="flex">
			{options.map((option, index) => {
				const active = option.value === value;

				return (
					<Key
						key={option.value}
						role={role === 'tablist' ? 'tab' : 'radio'}
						aria-selected={role === 'tablist' ? active : undefined}
						aria-checked={role === 'radiogroup' ? active : undefined}
						pressed={active}
						onClick={() => onChange(option.value)}
						className={cn(index > 0 && '-ml-px')}
					>
						{option.label}
					</Key>
				);
			})}
		</div>
	);
}
