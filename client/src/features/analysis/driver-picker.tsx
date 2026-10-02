import type { Driver } from '@f1-live/shared';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export function DriverPicker({
	drivers,
	selected,
	onChange
}: {
	drivers: readonly Driver[];
	selected: readonly string[];
	onChange: (codes: string[]) => void;
}) {
	return (
		<ToggleGroup
			type="multiple"
			variant="outline"
			size="sm"
			value={[...selected]}
			onValueChange={(codes) => {
				if (codes.length > 0) {
					onChange(codes);
				}
			}}
			aria-label="Drivers to compare"
		>
			{drivers.map((driver) => (
				<ToggleGroupItem key={driver.number} value={driver.code}>
					<span className="font-mono text-xs">{driver.code}</span>
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
