import type { TrackStatus } from '@f1-live/shared';

import { Badge } from '@/components/ui/badge';

const LABEL: Record<TrackStatus, string> = {
	green: 'Green flag',
	yellow: 'Yellow flag',
	vsc: 'Virtual Safety Car',
	safety_car: 'Safety Car',
	red: 'Red flag'
};

export function TrackStatusBadge({ status }: { status: TrackStatus }) {
	const variant =
		status === 'green' ? 'success' : status === 'red' ? 'destructive' : ('warning' as const);

	return <Badge variant={variant}>{LABEL[status]}</Badge>;
}
