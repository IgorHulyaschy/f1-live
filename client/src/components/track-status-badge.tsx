import type { TrackStatus } from '@f1-live/shared';

import { cn } from '@/lib/utils';

export const TRACK_STATUS_LABEL: Record<TrackStatus, string> = {
	green: 'Green flag',
	yellow: 'Yellow flag',
	vsc: 'Virtual Safety Car',
	safety_car: 'Safety Car',
	red: 'Red flag'
};

const DOT_CLASS: Record<TrackStatus, string> = {
	green: 'bg-personal-best',
	yellow: 'bg-safety-car',
	vsc: 'bg-safety-car',
	safety_car: 'bg-safety-car',
	red: 'bg-primary'
};

export function TrackStatusBadge({ status }: { status: TrackStatus }) {
	return (
		<span
			className="font-display inline-flex items-center gap-2 text-sm font-semibold tracking-wider uppercase"
			data-testid="track-status"
		>
			<span
				aria-hidden
				className={cn(
					'size-2 rounded-full',
					DOT_CLASS[status],
					status !== 'green' && 'animate-live-dot'
				)}
			/>
			{TRACK_STATUS_LABEL[status]}
		</span>
	);
}
