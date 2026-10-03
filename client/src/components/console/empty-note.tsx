import { useRaceView } from '@/data/race-context';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';

/** Why a panel is empty: the session has not started, has no timing, or no laps are done yet. */
export function useEmptyReason(): string {
	const { race } = useRaceView();
	const now = useNow();

	if (race.drivers.length === 0) {
		return Date.parse(race.session.startsAt) > now
			? 'This fills in once the session starts.'
			: 'This session’s data has no timing.';
	}

	return 'This fills in once the first laps are done.';
}

/** The line a panel shows instead of a blank body. */
export function EmptyNote({ children, className }: { children?: string; className?: string }) {
	const reason = useEmptyReason();

	return (
		<p
			className={cn('text-muted-foreground px-4 py-4 text-sm', className)}
			data-testid="empty-note"
		>
			{children ?? reason}
		</p>
	);
}
