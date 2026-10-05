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
				'type-label inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 border border-b-2 px-2 whitespace-nowrap sm:h-7 sm:px-2.5 transition-colors select-none focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:outline-none disabled:cursor-default disabled:opacity-40 [&_svg]:size-3.5',
				pressed
					? 'border-foreground bg-foreground text-background'
					: 'hover:text-foreground hover:border-rule-strong',
				className
			)}
			{...props}
		/>
	);
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);

const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * A row of keys where exactly one is pressed. Only the pressed key is in the tab order; arrow
 * keys, Home and End move between keys and select as they go, like native radio buttons.
 */
export function KeyGroup<Value extends string>({
	options,
	value,
	onChange,
	label,
	role = 'radiogroup',
	controls
}: {
	options: readonly { value: Value; label: React.ReactNode; title?: string }[];
	value: Value;
	onChange: (value: Value) => void;
	label: string;
	role?: 'radiogroup' | 'tablist';
	/** The id of the panel a tablist switches. */
	controls?: string;
}) {
	const current = options.findIndex((option) => option.value === value);

	function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
		const last = options.length - 1;
		let next: number | null = null;

		if (NEXT_KEYS.has(event.key)) {
			next = current >= last ? 0 : current + 1;
		} else if (PREVIOUS_KEYS.has(event.key)) {
			next = current <= 0 ? last : current - 1;
		} else if (event.key === 'Home') {
			next = 0;
		} else if (event.key === 'End') {
			next = last;
		}

		const option = next === null ? undefined : options[next];

		if (next === null || !option) {
			return;
		}

		// Arrow keys also step through laps globally; inside the group they belong to the group.
		event.preventDefault();
		event.stopPropagation();
		onChange(option.value);
		event.currentTarget.parentElement?.querySelectorAll('button').item(next).focus();
	}

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
						aria-controls={role === 'tablist' ? controls : undefined}
						tabIndex={active ? 0 : -1}
						pressed={active}
						title={option.title}
						onClick={() => onChange(option.value)}
						onKeyDown={onKeyDown}
						className={cn(index > 0 && '-ml-px')}
					>
						{option.label}
					</Key>
				);
			})}
		</div>
	);
}
