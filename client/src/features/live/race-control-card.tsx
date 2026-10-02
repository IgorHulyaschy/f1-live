import type { RaceControlCategory } from '@f1-live/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRace } from '@/data/race-context';

const VISIBLE_MESSAGES = 6;

const CATEGORY_LABEL: Record<RaceControlCategory, string> = {
	flag: 'Flag',
	safety_car: 'VSC / SC',
	drs: 'DRS',
	penalty: 'Penalty',
	incident: 'Incident',
	other: 'Info'
};

const CATEGORY_VARIANT = {
	flag: 'outline',
	safety_car: 'warning',
	drs: 'secondary',
	penalty: 'destructive',
	incident: 'secondary',
	other: 'outline'
} as const satisfies Record<RaceControlCategory, string>;

export function RaceControlCard() {
	const { snapshot } = useRace();
	const messages = snapshot.raceControl.slice(-VISIBLE_MESSAGES).toReversed();

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Race control</CardTitle>
				<CardDescription>Latest messages from the FIA.</CardDescription>
			</CardHeader>
			<CardContent>
				{messages.length === 0 ? (
					<p className="text-muted-foreground text-sm">No messages yet.</p>
				) : (
					<ol className="flex flex-col gap-3" data-testid="race-control">
						{messages.map((message) => (
							<li key={`${message.lap}-${message.message}`} className="flex flex-col gap-1">
								<span className="flex items-center gap-2">
									<span className="text-muted-foreground font-mono text-xs">L{message.lap}</span>
									<Badge variant={CATEGORY_VARIANT[message.category]}>
										{CATEGORY_LABEL[message.category]}
									</Badge>
								</span>
								<span className="text-sm leading-snug">{message.message}</span>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
