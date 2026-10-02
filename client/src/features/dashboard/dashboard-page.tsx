import {
	CopyIcon,
	DownloadIcon,
	ExternalLinkIcon,
	LockIcon,
	MaximizeIcon,
	PencilIcon,
	PlusIcon,
	RotateCcwIcon,
	Trash2Icon,
	UploadIcon
} from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Key, KeyGroup } from '@/components/console/keys';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog';
import { type Scale, SCALES, setScale, useScale } from '@/hooks/use-scale';

import { forgetDashboard, newId, saveDashboard, useDashboards } from './dashboard-store';
import { DashboardGrid } from './dashboard-grid';
import {
	addTile,
	type Dashboard,
	isPreset,
	parseDashboardText,
	TILE_INFO,
	TILE_KINDS
} from './dashboards';
import { dashboardPath } from './paths';
import { useCarriedSearch } from './use-carried-search';

const SCALE_OPTIONS = SCALES.map(({ value, label }) => ({ value, label }));

function AddTileDialog({
	open,
	onOpenChange,
	onAdd
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAdd: (kind: (typeof TILE_KINDS)[number]) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="top-[10%] sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add tile</DialogTitle>
					<DialogDescription>
						Tiles land at the bottom. Drag the bar on top to move one, the corner to resize.
					</DialogDescription>
				</DialogHeader>
				<ul className="grid max-h-[60svh] overflow-y-auto border-t sm:grid-cols-2">
					{TILE_KINDS.map((kind) => (
						<li key={kind} className="border-b sm:odd:border-r">
							<button
								type="button"
								onClick={() => onAdd(kind)}
								className="hover:bg-accent focus-visible:bg-accent flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors focus-visible:outline-none"
							>
								<span className="type-wide flex items-center gap-2 text-xs font-bold">
									{TILE_INFO[kind].title}
									{TILE_INFO[kind].pro ? (
										<span className="type-label flex items-center gap-1 border px-1">
											<LockIcon aria-hidden className="size-2.5" />
											Pro
										</span>
									) : null}
								</span>
								<span className="text-muted-foreground text-xs">{TILE_INFO[kind].description}</span>
							</button>
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
}

function download(dashboard: Dashboard): void {
	const blob = new Blob([JSON.stringify(dashboard, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = `pitwall-${dashboard.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

/** Starts a new dashboard and opens it in edit mode. */
export function useCreateDashboard(): (from?: Dashboard) => void {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	return (from) => {
		const id = newId('board');

		saveDashboard(
			from
				? { ...from, id, name: `${from.name} copy`.slice(0, 40) }
				: { id, name: 'My dashboard', tiles: [], layout: [] }
		);

		const params = new URLSearchParams(searchParams);

		params.set('edit', '1');
		void navigate({ pathname: dashboardPath(id), search: params.toString() });
	};
}

function DashboardBar({
	dashboard,
	edited,
	editing,
	setEditing,
	onChange
}: {
	dashboard: Dashboard;
	edited: boolean;
	editing: boolean;
	setEditing: (editing: boolean) => void;
	onChange: (dashboard: Dashboard) => void;
}) {
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const scale = useScale();
	const create = useCreateDashboard();
	const [adding, setAdding] = React.useState(false);
	const fileInput = React.useRef<HTMLInputElement>(null);
	const preset = isPreset(dashboard.id);

	const importFile = async (file: File) => {
		try {
			const parsed = parseDashboardText(await file.text());

			if (!parsed) {
				throw new Error('Not a dashboard');
			}

			const id = newId('board');

			saveDashboard({ ...parsed, id });
			toast(`Imported ${parsed.name}`);
			void navigate({ pathname: dashboardPath(id), search });
		} catch {
			toast('That file is not a Pitwall dashboard.');
		}
	};

	return (
		<section
			className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4"
			data-testid="dashboard-bar"
			aria-label="Dashboard controls"
		>
			{editing ? (
				<input
					aria-label="Dashboard name"
					value={dashboard.name}
					maxLength={40}
					onChange={(event) => onChange({ ...dashboard, name: event.target.value })}
					onBlur={() => {
						const name = dashboard.name.trim();

						if (name !== dashboard.name || !name) {
							onChange({ ...dashboard, name: name || 'Untitled' });
						}
					}}
					className="type-wide border-rule-strong focus-visible:border-foreground h-9 w-56 border-b-2 bg-transparent text-sm font-bold outline-none sm:h-7"
				/>
			) : (
				<h2 className="type-wide text-sm font-bold">{dashboard.name}</h2>
			)}
			{editing ? (
				<div className="flex flex-wrap gap-2">
					<Key pressed data-add-tile onClick={() => setAdding(true)}>
						<PlusIcon />
						Add tile
					</Key>
					<Key onClick={() => create(dashboard)}>
						<CopyIcon />
						Duplicate
					</Key>
					<Key onClick={() => download(dashboard)}>
						<DownloadIcon />
						Export
					</Key>
					<Key onClick={() => fileInput.current?.click()}>
						<UploadIcon />
						Import
					</Key>
					{preset ? (
						<Key disabled={!edited} onClick={() => forgetDashboard(dashboard.id)}>
							<RotateCcwIcon />
							Reset
						</Key>
					) : (
						<Key
							onClick={() => {
								forgetDashboard(dashboard.id);
								void navigate({ pathname: '/', search });
							}}
						>
							<Trash2Icon />
							Delete
						</Key>
					)}
					<input
						ref={fileInput}
						type="file"
						accept="application/json,.json"
						className="hidden"
						aria-label="Import dashboard file"
						onChange={(event) => {
							const file = event.target.files?.[0];

							if (file) {
								void importFile(file);
							}

							event.target.value = '';
						}}
					/>
				</div>
			) : null}
			{editing ? (
				<p id="tile-arrange-help" className="type-label hidden w-full xl:order-last xl:block">
					Drag a tile by its bar, resize from the edges. Keyboard: focus a grip, arrows move, Shift
					and arrows resize.
				</p>
			) : null}
			<div className="ml-auto flex flex-wrap items-center gap-2">
				<span className="hidden lg:block">
					<KeyGroup<Scale>
						label="Text size"
						options={SCALE_OPTIONS}
						value={scale}
						onChange={setScale}
					/>
				</span>
				<Key
					className="hidden sm:inline-flex"
					onClick={() => window.open(`${window.location.pathname}?${search}`, '_blank', 'noopener')}
				>
					<ExternalLinkIcon />
					New window
				</Key>
				<Key
					className="hidden lg:inline-flex"
					pressed={Boolean(dashboard.fit)}
					aria-label="Fit to screen height"
					onClick={() => onChange({ ...dashboard, fit: !dashboard.fit })}
				>
					<MaximizeIcon />
					Fit
				</Key>
				<Key pressed={editing} onClick={() => setEditing(!editing)}>
					<PencilIcon />
					{editing ? 'Done' : 'Edit'}
				</Key>
			</div>
			<AddTileDialog
				open={adding}
				onOpenChange={setAdding}
				onAdd={(kind) => {
					onChange(addTile(dashboard, kind, newId(kind)));
					setAdding(false);
				}}
			/>
		</section>
	);
}

/** A dashboard by id: presets at their old addresses, everything else under /d/:id. */
export function DashboardPage({ id: fixedId }: { id?: string }) {
	const params = useParams();
	const id = fixedId ?? params.id ?? 'live';
	const { dashboards, saved } = useDashboards();
	const [searchParams, setSearchParams] = useSearchParams();
	const dashboard = dashboards.find((entry) => entry.id === id);
	const editing = searchParams.get('edit') === '1';

	const setEditing = (next: boolean) =>
		setSearchParams(
			(current) => {
				if (next) {
					current.set('edit', '1');
				} else {
					current.delete('edit');
				}

				return current;
			},
			{ replace: true }
		);

	if (!dashboard) {
		return (
			<div className="text-muted-foreground border border-dashed p-8 text-sm" role="alert">
				This dashboard does not exist on this device. Dashboards are saved in the browser that made
				them; use Export and Import to move one.
			</div>
		);
	}

	return (
		<div data-testid={`dashboard-${dashboard.id}`}>
			<DashboardBar
				dashboard={dashboard}
				edited={saved.has(dashboard.id)}
				editing={editing}
				setEditing={setEditing}
				onChange={saveDashboard}
			/>
			<DashboardGrid dashboard={dashboard} editing={editing} onChange={saveDashboard} />
		</div>
	);
}
