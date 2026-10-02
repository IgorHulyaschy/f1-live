import { LockIcon } from 'lucide-react';
import type * as React from 'react';

import { Key } from '@/components/console/keys';
import { useRace } from '@/data/race-context';

/**
 * Pro content for Pro viewers. Everyone else gets one line saying what they would see and one
 * key to preview it, behind a hatched edge: no blurred slabs.
 */
export function ProGate({
	feature,
	teaser,
	children
}: {
	feature: string;
	/** What the locked feature would answer right now, in the viewer's terms. */
	teaser?: React.ReactNode;
	children: React.ReactNode;
}) {
	const { plan, setPlan } = useRace();

	if (plan === 'pro') {
		return children;
	}

	return (
		<div className="flex items-stretch">
			<span aria-hidden className="hatch text-foreground/25 w-3 shrink-0 border-r" />
			<div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
				<LockIcon className="text-muted-foreground size-3.5" aria-hidden />
				<div className="flex min-w-48 flex-1 flex-col">
					<span className="text-sm font-medium">{feature} is part of Pro</span>
					{teaser ? <span className="text-muted-foreground text-xs">{teaser}</span> : null}
				</div>
				<Key onClick={() => setPlan('pro')}>Preview Pro</Key>
			</div>
		</div>
	);
}
