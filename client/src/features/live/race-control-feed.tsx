import type { RaceControlCategory } from '@f1-live/shared';
import {
	CloudRainIcon,
	DropletsIcon,
	FlagIcon,
	GavelIcon,
	InfoIcon,
	type LucideIcon,
	SirenIcon,
	ThermometerIcon,
	TriangleAlertIcon,
	WindIcon,
	ZapIcon
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Panel, PanelHeader } from '@/components/console/panel';
import { useRace } from '@/data/race-context';
import { cn } from '@/lib/utils';

const VISIBLE_MESSAGES = 6;

const CATEGORY_ICON = {
	flag: FlagIcon,
	safety_car: SirenIcon,
	drs: ZapIcon,
	penalty: GavelIcon,
	incident: TriangleAlertIcon,
	other: InfoIcon
} as const satisfies Record<RaceControlCategory, LucideIcon>;

const CATEGORY_TONE: Record<RaceControlCategory, string> = {
	flag: 'text-foreground',
	safety_car: 'text-safety-car',
	drs: 'text-drs',
	penalty: 'text-primary',
	incident: 'text-warning',
	other: 'text-muted-foreground'
};

const KEEP_UPPERCASE = /\b(vsc|sc|drs|fia|dsq)\b/g;

/** FIA messages arrive in capitals; sentence case reads faster. Driver codes stay upper case. */
function readable(message: string): string {
	const lower = message
		.toLowerCase()
		.replaceAll(/\(([a-z]{3})\)/g, (_, code: string) => `(${code.toUpperCase()})`)
		.replaceAll(KEEP_UPPERCASE, (word) => word.toUpperCase());

	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function Conditions() {
	const { snapshot } = useRace();
	const weather = snapshot.weather.at(-1);

	if (!weather) {
		return null;
	}

	const readings = [
		{ icon: ThermometerIcon, label: 'Track', value: `${weather.trackTempC.toFixed(1)}°` },
		{ icon: ThermometerIcon, label: 'Air', value: `${weather.airTempC.toFixed(1)}°` },
		{ icon: DropletsIcon, label: 'Humidity', value: `${weather.humidityPct}%` },
		weather.rainfall
			? { icon: CloudRainIcon, label: 'Rain', value: 'Falling' }
			: { icon: WindIcon, label: 'Wind', value: `${weather.windSpeedMs.toFixed(1)} m/s` }
	];

	return (
		<dl className="grid grid-cols-4 divide-x border-t" aria-label="Conditions">
			{readings.map((reading) => (
				<div key={reading.label} className="flex flex-col gap-0.5 px-3 py-2.5">
					<dt className="text-muted-foreground flex items-center gap-1 text-xs">
						<reading.icon className="size-3" aria-hidden />
						{reading.label}
					</dt>
					<dd className="font-mono text-sm">{reading.value}</dd>
				</div>
			))}
		</dl>
	);
}

export function RaceControlFeed() {
	const { snapshot } = useRace();
	const messages = snapshot.raceControl.slice(-VISIBLE_MESSAGES).toReversed();

	return (
		<Panel aria-label="Race control" className="flex-1">
			<PanelHeader title="Race control" meta={`${snapshot.raceControl.length} messages`} />
			{messages.length === 0 ? (
				<p className="text-muted-foreground px-4 py-4 text-sm">No messages yet.</p>
			) : (
				<ol className="flex flex-col px-4 py-2" data-testid="race-control">
					<AnimatePresence initial={false} mode="popLayout">
						{messages.map((message) => {
							const Icon = CATEGORY_ICON[message.category];

							return (
								<motion.li
									key={`${message.lap}-${message.message}`}
									layout
									initial={{ opacity: 0, y: -8 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.25 }}
									className="flex gap-3 border-b py-2.5 last:border-b-0"
								>
									<Icon
										className={cn('mt-0.5 size-4 shrink-0', CATEGORY_TONE[message.category])}
										aria-hidden
									/>
									<span className="flex min-w-0 flex-col gap-0.5">
										<span className="text-sm leading-snug">{readable(message.message)}</span>
										<span className="text-muted-foreground font-mono text-xs">
											Lap {message.lap}
										</span>
									</span>
								</motion.li>
							);
						})}
					</AnimatePresence>
				</ol>
			)}
			<Conditions />
		</Panel>
	);
}
