import type { DrillSettings } from '@f1-live/shared/dashboard';

import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useRaceView } from '@/data/race-context';
import { DRILL_SECTION_TITLE } from '@/features/dashboard/dashboards';

import { CompareView } from './compare-view';
import { SectionHostContext } from './drill-parts';
import { driverPart, useDriverSession } from './driver-view';

/** The picker's value for "whoever the viewer follows", kept as no driver in the settings. */
const FOLLOWED = 'followed';

const IN_TILE = { inTile: true };

function DriverPicker({
	label,
	value,
	followed,
	onChange
}: {
	label: string;
	value: string | undefined;
	followed?: boolean;
	onChange: (driver: string | undefined) => void;
}) {
	const { race } = useRaceView();

	return (
		<Select
			value={value ?? (followed ? FOLLOWED : '')}
			onValueChange={(next) => onChange(next === FOLLOWED ? undefined : next)}
		>
			<SelectTrigger size="sm" aria-label={label}>
				<SelectValue placeholder="Pick a driver" />
			</SelectTrigger>
			<SelectContent>
				{followed ? <SelectItem value={FOLLOWED}>The driver I follow</SelectItem> : null}
				{race.drivers.map((driver) => (
					<SelectItem key={driver.number} value={driver.number}>
						{driver.code} {driver.lastName}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function PartBody({ driverNumber, settings }: { driverNumber: string; settings?: DrillSettings }) {
	const { snapshot, driver, laps } = useDriverSession(driverNumber);
	const section = settings?.section ?? 'laps';

	if (!driver) {
		return <EmptyNote>This car is not in this session.</EmptyNote>;
	}

	if (section === 'compare') {
		return settings?.vs ? (
			<CompareView a={driver.number} b={settings.vs} />
		) : (
			<EmptyNote>Pick a driver to compare with.</EmptyNote>
		);
	}

	const part = driverPart(section, { snapshot, driver, laps });

	return part === null ? (
		<EmptyNote>Not part of this kind of session.</EmptyNote>
	) : (
		<SectionHostContext value={IN_TILE}>
			<div className="flex flex-col gap-2 px-4 py-3">{part}</div>
		</SectionHostContext>
	);
}

/**
 * One part of the driver view as a tile: for a set driver, or for whoever the viewer follows, so
 * the tile changes with them.
 */
export function DrillTile({
	settings,
	onSettingsChange
}: {
	settings?: DrillSettings;
	onSettingsChange?: (settings: DrillSettings) => void;
}) {
	const { race, followedDriver } = useRaceView();
	const section = settings?.section ?? 'laps';
	const driverNumber = settings?.driver ?? followedDriver;
	const driver = race.drivers.find((entry) => entry.number === driverNumber);
	const title = DRILL_SECTION_TITLE[section];

	return (
		<Panel
			aria-label={`${title}: ${driver?.code ?? driverNumber}`}
			className="h-full"
			data-testid="drill-tile"
			data-driver={settings?.driver ?? FOLLOWED}
		>
			<PanelHeader title={title} meta={driver?.code}>
				{onSettingsChange ? (
					<>
						<DriverPicker
							label="Whose"
							value={settings?.driver}
							followed
							onChange={(next) => onSettingsChange({ ...settings, driver: next })}
						/>
						{section === 'compare' ? (
							<DriverPicker
								label="Compare with"
								value={settings?.vs}
								onChange={(vs) => onSettingsChange({ ...settings, vs })}
							/>
						) : null}
					</>
				) : null}
			</PanelHeader>
			<div className="min-h-0 flex-1 overflow-auto">
				<PartBody driverNumber={driverNumber} settings={settings} />
			</div>
		</Panel>
	);
}
