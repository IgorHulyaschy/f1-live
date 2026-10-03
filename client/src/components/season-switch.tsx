import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Key } from '@/components/console/keys';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';

/**
 * The season on screen, with keys for the one before and after: a row of years outgrows a phone
 * once the archive holds a handful of seasons.
 */
export function SeasonSwitch({
	years,
	value,
	onChange,
	label = 'Season'
}: {
	/** Oldest first. */
	years: readonly number[];
	value: number;
	onChange: (year: number) => void;
	label?: string;
}) {
	const index = years.indexOf(value);
	const previous = years[index - 1];
	const next = years[index + 1];

	return (
		<fieldset className="flex items-center">
			<legend className="sr-only">{label}</legend>
			<Key
				aria-label={previous === undefined ? 'No earlier season' : `Season ${previous}`}
				disabled={previous === undefined}
				onClick={() => previous !== undefined && onChange(previous)}
			>
				<ChevronLeftIcon />
			</Key>
			<Select value={String(value)} onValueChange={(year) => onChange(Number(year))}>
				<SelectTrigger size="sm" aria-label={label} className="-ml-px">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{years.toReversed().map((year) => (
						<SelectItem key={year} value={String(year)}>
							{year}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Key
				aria-label={next === undefined ? 'No later season' : `Season ${next}`}
				disabled={next === undefined}
				onClick={() => next !== undefined && onChange(next)}
				className="-ml-px"
			>
				<ChevronRightIcon />
			</Key>
		</fieldset>
	);
}
