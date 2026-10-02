import { motion } from 'motion/react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Tabs drawn as a segmented control; the active marker slides between options. */
export function Segmented<Value extends string>({
	options,
	value,
	onChange,
	label
}: {
	options: readonly { value: Value; label: string }[];
	value: Value;
	onChange: (value: Value) => void;
	label: string;
}) {
	const id = React.useId();

	return (
		<div role="tablist" aria-label={label} className="bg-muted flex rounded-md p-0.5">
			{options.map((option) => {
				const active = option.value === value;

				return (
					<button
						key={option.value}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(option.value)}
						className={cn(
							'relative rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
							active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
						)}
					>
						{active ? (
							<motion.span
								layoutId={`segment-${id}`}
								className="bg-background absolute inset-0 rounded shadow-sm"
								transition={{ type: 'spring', stiffness: 500, damping: 40 }}
							/>
						) : null}
						<span className="relative">{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}
