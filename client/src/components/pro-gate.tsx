import { LockIcon } from 'lucide-react';
import type * as React from 'react';

import { Button } from '@/components/ui/button';
import { useRace } from '@/data/race-context';

/** Shows Pro content to Pro viewers, and a blurred preview with an upgrade prompt to others. */
export function ProGate({ feature, children }: { feature: string; children: React.ReactNode }) {
	const { plan, setPlan } = useRace();

	if (plan === 'pro') {
		return children;
	}

	return (
		<div className="relative">
			<div aria-hidden className="pointer-events-none blur-sm select-none" inert>
				{children}
			</div>
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
				<span className="bg-background/80 flex size-10 items-center justify-center rounded-full border">
					<LockIcon className="size-4" />
				</span>
				<p className="max-w-64 text-sm font-medium">{feature} is part of Pro</p>
				<Button size="sm" onClick={() => setPlan('pro')}>
					Preview Pro
				</Button>
			</div>
		</div>
	);
}
