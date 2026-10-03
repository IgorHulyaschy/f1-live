import type { RaceControlCategory, RaceControlMessage } from '@f1-live/shared';
import { AnimatePresence, m } from 'motion/react';
import * as React from 'react';

import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { useRaceView } from '@/data/race-context';
import { ACTIONABLE, DriverLink, useJumpTo } from '@/features/drill/drill-parts';
import { isTimedSession } from '@/insights/qualifying';
import { isAidSwitch } from '@/insights/rules';
import { cn } from '@/lib/utils';

const VISIBLE_MESSAGES = 7;

type Filter = 'all' | 'flags' | 'stewards' | 'mine';

const FILTERS = [
	{ value: 'all', label: 'All' },
	{ value: 'flags', label: 'Flags' },
	{ value: 'stewards', label: 'Stewards' },
	{ value: 'mine', label: 'Mine' }
] as const;

/** Printed category codes, coloured only where the colour is the regulated one. */
const CATEGORY: Record<RaceControlCategory, { code: string; tone: string }> = {
	flag: { code: 'Flag', tone: 'text-flag-ink' },
	safety_car: { code: 'VSC/SC', tone: 'text-flag-ink' },
	drs: { code: 'DRS', tone: 'text-muted-foreground' },
	penalty: { code: 'Pen', tone: 'text-danger' },
	incident: { code: 'Inc', tone: 'text-foreground' },
	other: { code: 'Info', tone: 'text-muted-foreground' }
};

const KEEP_UPPERCASE = /\b(vsc|sc|drs|fia|dsq)\b/g;

/** FIA messages arrive in capitals; sentence case reads faster. Driver codes stay upper case. */
function readable(message: string): string {
	const lower = message
		.toLowerCase()
		.replace(/^fia stewards: /, '')
		.replaceAll(/\(([a-z]{3})\)/g, (_, code: string) => `(${code.toUpperCase()})`)
		.replaceAll(KEEP_UPPERCASE, (word) => word.toUpperCase());

	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** The category code, with 2026's overtake-mode switches read like DRS ones. */
function categoryOf(message: RaceControlMessage): { code: string; tone: string } {
	return isAidSwitch(message) && message.message.includes('OVERTAKE')
		? { code: 'OVT', tone: CATEGORY.drs.tone }
		: CATEGORY[message.category];
}

function matches(message: RaceControlMessage, filter: Filter, driverNumber: string): boolean {
	switch (filter) {
		case 'all':
			return true;
		case 'flags':
			return message.category === 'flag' || message.category === 'safety_car';
		case 'stewards':
			return message.category === 'penalty' || message.category === 'incident';
		case 'mine':
			return (
				message.driverNumber === driverNumber || message.message.includes(`CAR ${driverNumber} `)
			);
	}
}

function Conditions() {
	const { snapshot } = useRaceView();
	const weather = snapshot.weather.at(-1);

	if (!weather) {
		return null;
	}

	const readings = [
		{ label: 'Track', value: `${weather.trackTempC.toFixed(1)}°C` },
		{ label: 'Air', value: `${weather.airTempC.toFixed(1)}°C` },
		{ label: 'Humidity', value: `${weather.humidityPct}%` },
		weather.rainfall
			? { label: 'Rain', value: 'Falling' }
			: { label: 'Wind', value: `${weather.windSpeedMs.toFixed(1)}m/s` }
	];

	return (
		<dl className="mt-auto grid grid-cols-4 divide-x border-t" aria-label="Conditions">
			{readings.map((reading) => (
				<div key={reading.label} className="flex flex-col px-3 py-2">
					<dt className="type-label">{reading.label}</dt>
					<dd className="font-mono text-sm">{reading.value}</dd>
				</div>
			))}
		</dl>
	);
}

/** Where a message fell: its lap in a race, its minute of the session on the clock. */
function stamp(message: RaceControlMessage, startMs: number | null): string {
	if (startMs === null || message.at === undefined) {
		return `L${message.lap}`;
	}

	return `${Math.max(0, Math.ceil((Date.parse(message.at) - startMs) / 60_000))}m`;
}

export function RaceControlFeed() {
	const { snapshot, followedDriver } = useRaceView();
	const [filter, setFilter] = React.useState<Filter>('all');
	const jumpTo = useJumpTo();

	const startMs =
		isTimedSession(snapshot.session.type) && snapshot.startedAt
			? Date.parse(snapshot.startedAt)
			: null;

	const messages = snapshot.raceControl
		.filter((message) => matches(message, filter, followedDriver))
		.slice(-VISIBLE_MESSAGES)
		.toReversed();

	return (
		<Panel aria-label="Race control" className="flex-1">
			<PanelHeader title="Race control">
				<KeyGroup label="Messages shown" options={FILTERS} value={filter} onChange={setFilter} />
			</PanelHeader>
			{messages.length === 0 ? (
				<p className="text-muted-foreground px-4 py-4 text-sm">Nothing here yet.</p>
			) : (
				<ol className="flex flex-col" data-testid="race-control">
					<AnimatePresence initial={false} mode="popLayout">
						{messages.map((message, index) => {
							const category = categoryOf(message);

							const driver = snapshot.drivers.find(
								(entry) => entry.number === message.driverNumber
							);

							// Race control can repeat a message on the same lap. The list is newest first, so
							// count the older copies below: a new copy then never takes an old one's key.
							const repeat = messages
								.slice(index + 1)
								.filter(
									(other) => other.lap === message.lap && other.message === message.message
								).length;

							return (
								<m.li
									key={`${message.lap}-${message.message}-${repeat}`}
									layout
									initial={{ opacity: 0, x: -6 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.2 }}
									className="flex items-start gap-2 border-b px-4 last:border-b-0"
								>
									<button
										type="button"
										onClick={() => jumpTo(message)}
										aria-label={`${readable(message.message)}: go to ${stamp(message, startMs)}`}
										className={cn(
											ACTIONABLE,
											'-mx-1 grid min-w-0 flex-1 grid-cols-[2.5rem_3.5rem_minmax(0,1fr)] gap-2 px-1 py-2.5 text-left'
										)}
									>
										<span className="text-muted-foreground font-mono text-xs leading-5">
											{stamp(message, startMs)}
										</span>
										<span className={cn('type-label leading-5 font-bold', category.tone)}>
											{category.code}
										</span>
										<span className="text-sm leading-5">{readable(message.message)}</span>
									</button>
									{driver ? (
										<DriverLink driver={driver} className="mt-2 shrink-0">
											<DriverTag driver={driver} />
										</DriverLink>
									) : null}
								</m.li>
							);
						})}
					</AnimatePresence>
				</ol>
			)}
			<Conditions />
		</Panel>
	);
}
