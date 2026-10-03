import type { DrillSettings } from '@f1-live/shared/dashboard';
import { LayoutDashboardIcon, PlusIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Key } from '@/components/console/keys';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { newId, saveDashboard } from '@/features/dashboard/dashboard-store';
import { addTile, DRILL_SECTION_TITLE, drillDashboard } from '@/features/dashboard/dashboards';
import { useAddDashboard } from '@/features/dashboard/use-add-dashboard';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { useDashboardNav } from '@/features/dashboard/use-dashboard-nav';

/** Adds one part of the view, bound to its driver, under the tiles of a dashboard picked here. */
export function AddToDashboard({ settings }: { settings: DrillSettings }) {
	const { all } = useDashboardNav();
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const title = DRILL_SECTION_TITLE[settings.section ?? 'laps'];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Key
					aria-label={`Add ${title} to a dashboard`}
					data-testid={`drill-add-${settings.section}`}
				>
					<PlusIcon aria-hidden />
					<span className="@max-lg:sr-only">Add to dashboard</span>
				</Key>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					<span className="type-label">Add {title} to</span>
				</DropdownMenuLabel>
				{all.map((entry) => (
					<DropdownMenuItem
						key={entry.dashboard.id}
						onSelect={() => {
							saveDashboard(addTile(entry.dashboard, 'drill', newId('drill'), settings));
							toast(`${title} added to ${entry.label}`, {
								action: {
									label: 'Open',
									onClick: () => void navigate({ pathname: entry.path, search })
								}
							});
						}}
					>
						{entry.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Saves the whole view as a dashboard of its own, a tile per part, and opens it. */
export function MakeDashboard({ name, parts }: { name: string; parts: readonly DrillSettings[] }) {
	const add = useAddDashboard();

	return (
		<Key onClick={() => add(drillDashboard(name, parts))} data-testid="drill-make-dashboard">
			<LayoutDashboardIcon aria-hidden />
			Make a dashboard of this view
		</Key>
	);
}
