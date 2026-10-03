import { cn } from '@/lib/utils';

/** Leading characters that carry no information: signs, zeros and separators before the first significant digit. */
const LEADING = /^[+\-−]?[0:.]*/;

/**
 * Timing digits as a timing screen prints them: tabular mono, with the leading zeros and
 * separators dimmed so the eye lands on the digits that change.
 */
export function Digits({ value, className }: { value: string; className?: string }) {
	const sign = /^[+\-−]/.exec(value)?.[0] ?? '';
	const rest = value.slice(sign.length);
	const lead = LEADING.exec(rest)?.[0] ?? '';
	const dim = lead === rest ? lead.slice(0, -1) : lead;

	return (
		<span className={cn('font-mono', className)}>
			{sign ? <span className="opacity-65">{sign}</span> : null}
			{dim ? <span className="opacity-65">{dim}</span> : null}
			{rest.slice(dim.length)}
		</span>
	);
}
