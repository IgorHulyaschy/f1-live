import type { TrackStatus } from '@f1-live/shared';

import { cn } from '@/lib/utils';

export const TRACK_STATUS_LABEL: Record<TrackStatus, string> = {
	green: 'Green',
	yellow: 'Yellow',
	vsc: 'VSC',
	safety_car: 'Safety car',
	red: 'Red flag'
};

const SWATCH: Record<TrackStatus, string> = {
	green: 'bg-personal-best',
	yellow: 'bg-flag',
	vsc: 'bg-flag',
	safety_car: 'bg-flag',
	red: 'bg-danger'
};

/** Flag state as a square swatch and a printed word, like a marshal panel. */
export function TrackStatusBadge({ status }: { status: TrackStatus }) {
	return (
		<span
			className="type-wide inline-flex items-center gap-2 text-xs font-bold"
			data-testid="track-status"
		>
			<span
				aria-hidden
				className={cn('size-2.5', SWATCH[status], status !== 'green' && 'animate-live-dot')}
			/>
			{TRACK_STATUS_LABEL[status]}
		</span>
	);
}
