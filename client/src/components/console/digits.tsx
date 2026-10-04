import { m } from 'motion/react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Leading characters that carry no information: signs, zeros and separators before the first significant digit. */
const LEADING = /^[+\-−]?[0:.]*/;

/**
 * Timing digits as a timing screen prints them: tabular mono, with the leading zeros and
 * separators dimmed so the eye lands on the digits that change.
 */
export function Digits({
	value,
	className,
	tick = false
}: {
	value: string;
	className?: string;
	/** Rolls a new value in from above, so a number that changes is seen to change. */
	tick?: boolean;
}) {
	const sign = /^[+\-−]/.exec(value)?.[0] ?? '';
	const rest = value.slice(sign.length);
	const lead = LEADING.exec(rest)?.[0] ?? '';
	const dim = lead === rest ? lead.slice(0, -1) : lead;

	// The first value is drawn as it is, so a page does not open with every number rolling in; the
	// first change clears it and every value after that rolls.
	const [first, setFirst] = React.useState<string | null>(value);

	if (first !== null && first !== value) {
		setFirst(null);
	}

	return (
		<span className={cn('font-mono', className)}>
			{sign ? <span className="opacity-65">{sign}</span> : null}
			{dim ? <span className="opacity-65">{dim}</span> : null}
			{tick ? (
				<m.span
					key={value}
					className="inline-block"
					initial={first === null ? { opacity: 0.3, y: '-0.25em' } : false}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.2, ease: 'easeOut' }}
				>
					{rest.slice(dim.length)}
				</m.span>
			) : (
				rest.slice(dim.length)
			)}
		</span>
	);
}
