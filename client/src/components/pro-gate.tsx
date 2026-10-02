import { LockIcon } from 'lucide-react';
import type * as React from 'react';

import { Button } from '@/components/ui/button';
import { useRace } from '@/data/race-context';

/** Shows Pro content to Pro viewers; others see a faded preview with one way in. */
export function ProGate({ feature, children }: { feature: string; children: React.ReactNode }) {
	const { plan, setPlan } = useRace();

	if (plan === 'pro') {
		return children;
	}

	return (
		<div className="relative isolate">
			<div aria-hidden className="pointer-events-none opacity-40 blur-xs select-none" inert>
				{children}
			</div>
			<div className="from-panel/40 via-panel/80 to-panel/40 absolute inset-0 flex items-center justify-center bg-linear-to-b p-4">
				<div className="flex flex-col items-center gap-2 text-center">
					<span className="font-display text-primary flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
						<LockIcon className="size-3" aria-hidden />
						Pro
					</span>
					<p className="max-w-64 text-sm font-medium">{feature} is part of Pro</p>
					<Button size="sm" variant="outline" onClick={() => setPlan('pro')}>
						Preview Pro
					</Button>
				</div>
			</div>
		</div>
	);
}
