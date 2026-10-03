import { BRAND } from '@/brand';
import { cn } from '@/lib/utils';

/** Two forward-cut bars: a pit board seen edge-on. The second takes the followed team's colour. */
export function Wordmark({ nameClassName }: { nameClassName?: string }) {
	return (
		<span className="flex items-center gap-2">
			<span aria-hidden className="flex gap-0.5">
				<span className="cut-forward bg-foreground h-4 w-3" />
				<span className="cut-forward bg-focus h-4 w-3" />
			</span>
			<span className={cn('type-wide text-sm font-black italic', nameClassName)}>{BRAND.name}</span>
		</span>
	);
}
