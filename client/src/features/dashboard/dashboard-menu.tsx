import {
	CheckIcon,
	CopyIcon,
	DownloadIcon,
	ExternalLinkIcon,
	LockIcon,
	PencilIcon,
	PlusIcon,
	RotateCcwIcon,
	Share2Icon,
	Trash2Icon,
	UploadIcon
} from 'lucide-react';
import * as React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { BRAND, brandSlug } from '@/brand';
import { Key } from '@/components/console/keys';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog';
import { DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { useRace, useRaceView } from '@/data/race-context';
import { type SyncStatus, useSyncStatus } from '@/features/account/sync-status';
import { shareUrl } from '@/features/library/share';
import { entryState } from '@/lib/history-entry';

import { forgetDashboard, newId, saveDashboard, useDashboards } from './dashboard-store';
import {
	addTile,
	type Dashboard,
	isPreset,
	parseDashboardText,
	TILE_GROUPS,
	TILE_INFO,
	TILE_KINDS
} from './dashboards';
import { dashboardIdFromPath, SESSION_PATH } from './paths';
import { sessionLayoutId } from './session-layouts';
import { useAddDashboard, useCreateDashboard } from './use-add-dashboard';
import { useCarriedSearch } from './use-carried-search';

const SYNC_LABEL: Record<SyncStatus, string> = {
	local: 'Saved in this browser',
	pending: 'Saving to your account',
	blocked: 'On this device only: not in your account',
	synced: 'Synced to your account'
};

function AddTileDialog({
	open,
	onOpenChange,
	present,
	onAdd
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Kinds already on the dashboard; single-instance ones cannot be added again. */
	present: ReadonlySet<(typeof TILE_KINDS)[number]>;
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
				<div className="max-h-[60svh] overflow-y-auto">
					{TILE_GROUPS.map((group) => (
						<section key={group} aria-label={group}>
							<h3 className="type-label border-rule-strong border-b-2 pt-3 pb-1">{group}</h3>
							<ul className="grid sm:grid-cols-2">
								{TILE_KINDS.filter((kind) => TILE_INFO[kind].group === group).map((kind) => (
									<li key={kind} className="border-b sm:odd:border-r">
										<button
											type="button"
											disabled={TILE_INFO[kind].single && present.has(kind)}
											onClick={() => onAdd(kind)}
											className="hover:bg-accent focus-visible:bg-accent flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
										>
											<span className="type-wide flex items-center gap-2 text-xs font-bold">
												{TILE_INFO[kind].title}
												{TILE_INFO[kind].single && present.has(kind) ? (
													<span className="type-label">On this dashboard</span>
												) : null}
												{TILE_INFO[kind].pro ? (
													<span className="type-label flex items-center gap-1 border px-1">
														<LockIcon aria-hidden className="size-2.5" />
														Pro
													</span>
												) : null}
											</span>
											<span className="text-muted-foreground text-xs">
												{TILE_INFO[kind].description}
											</span>
										</button>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function download(dashboard: Dashboard): void {
	const blob = new Blob([JSON.stringify(dashboard, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = `${brandSlug()}-${dashboard.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

async function copyShareLink(dashboard: Dashboard, sessionKey: string): Promise<void> {
	const url = shareUrl(dashboard, sessionKey);

	try {
		await navigator.clipboard.writeText(url);
		toast('Link copied', { description: 'Anyone with it can add this dashboard to theirs.' });
	} catch {
		toast('Copy this link to share the dashboard', { description: url });
	}
}

export type DashboardTools = {
	dashboard: Dashboard;
	editing: boolean;
	setEditing: (editing: boolean) => void;
	/** Opens the tile picker, in edit mode so the new tile can be placed. */
	startAdding: () => void;
	/** The picker and the import file input; rendered once, outside any menu. */
	dialogs: React.ReactNode;
	menuItems: React.ReactNode;
};

/**
 * What can be done to the dashboard on screen, for the top bar: its menu entries, the edit
 * mode keys and the dialogs they open. Null on pages that show none of the viewer's dashboards.
 */
export function useDashboardTools(): DashboardTools | null {
	const { pathname } = useLocation();
	const { race } = useRaceView();
	const { sessionKey } = useRace();
	const { dashboards, saved } = useDashboards();
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const create = useCreateDashboard();
	const add = useAddDashboard();
	const [adding, setAdding] = React.useState(false);
	const fileInput = React.useRef<HTMLInputElement>(null);
	const id = dashboardIdFromPath(pathname, sessionLayoutId(race.session.type));
	const dashboard = dashboards.find((entry) => entry.id === id);
	const editing = searchParams.get('edit') === '1';

	if (!dashboard) {
		return null;
	}

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
			{ replace: true, state: entryState() }
		);

	const importFile = async (file: File) => {
		try {
			const parsed = parseDashboardText(await file.text());

			if (!parsed) {
				throw new Error('Not a dashboard');
			}

			if (add(parsed)) {
				toast(`Imported ${parsed.name}`);
			}
		} catch {
			toast(`That file is not a ${BRAND.name} dashboard.`);
		}
	};

	const startAdding = () => {
		setEditing(true);
		setAdding(true);
	};

	const preset = isPreset(dashboard.id);
	const edited = saved.has(dashboard.id);

	// One tap away in the menu, so it can be taken back.
	const remove = () => {
		const removed = dashboard;

		forgetDashboard(removed.id);
		toast(preset ? `${removed.name} is reset` : `${removed.name} is deleted`, {
			action: { label: 'Undo', onClick: () => saveDashboard(removed) }
		});

		if (!preset) {
			void navigate({ pathname: SESSION_PATH, search });
		}
	};

	const dialogs = (
		<>
			<AddTileDialog
				open={adding}
				onOpenChange={setAdding}
				present={new Set(dashboard.tiles.map((tile) => tile.kind))}
				onAdd={(kind) => {
					saveDashboard(addTile(dashboard, kind, newId(kind)));
					setAdding(false);
				}}
			/>
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
		</>
	);

	const menuItems = (
		<>
			<DropdownMenuLabel>
				<span className="type-label block truncate">{dashboard.name}</span>
			</DropdownMenuLabel>
			<DropdownMenuItem onSelect={() => setEditing(!editing)}>
				{editing ? <CheckIcon /> : <PencilIcon />}
				{editing ? 'Done editing' : 'Edit'}
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={startAdding}>
				<PlusIcon />
				Add tile
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => void copyShareLink(dashboard, sessionKey)}>
				<Share2Icon />
				Copy share link
			</DropdownMenuItem>
			<DropdownMenuItem
				onSelect={() => window.open(`${window.location.pathname}?${search}`, '_blank', 'noopener')}
			>
				<ExternalLinkIcon />
				Open in a new window
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => create(dashboard)}>
				<CopyIcon />
				Duplicate
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => download(dashboard)}>
				<DownloadIcon />
				Export
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => fileInput.current?.click()}>
				<UploadIcon />
				Import
			</DropdownMenuItem>
			{preset ? (
				<DropdownMenuItem disabled={!edited} onSelect={remove}>
					<RotateCcwIcon />
					Reset
				</DropdownMenuItem>
			) : (
				<DropdownMenuItem onSelect={remove}>
					<Trash2Icon />
					Delete
				</DropdownMenuItem>
			)}
		</>
	);

	return { dashboard, editing, setEditing, startAdding, dialogs, menuItems };
}

/** Edit mode in the top bar: the name, where it is saved, Add tile and Done. */
export function DashboardEditBar({ tools }: { tools: DashboardTools }) {
	const { dashboard, setEditing, startAdding } = tools;
	const syncStatus = useSyncStatus(dashboard.id);

	return (
		<section
			className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
			aria-label="Edit dashboard"
			data-testid="dashboard-edit"
		>
			<input
				aria-label="Dashboard name"
				name="dashboard-name"
				autoComplete="off"
				value={dashboard.name}
				maxLength={40}
				onChange={(event) => saveDashboard({ ...dashboard, name: event.target.value })}
				onBlur={() => {
					const name = dashboard.name.trim();

					if (name !== dashboard.name || !name) {
						saveDashboard({ ...dashboard, name: name || 'Untitled' });
					}
				}}
				className="type-wide border-rule-strong focus-visible:border-foreground h-9 w-28 min-w-0 shrink border-b-2 bg-transparent text-sm font-bold outline-none sm:h-7 sm:w-56"
			/>
			<span className="type-label truncate max-lg:sr-only" data-testid="save-status">
				{SYNC_LABEL[syncStatus]}
			</span>
			<p id="tile-arrange-help" className="sr-only">
				Drag a tile by its bar, resize from the edges. Keyboard: focus a grip, arrows move, Shift
				and arrows resize.
			</p>
			<span className="ml-auto flex shrink-0 gap-2">
				<Key data-add-tile onClick={startAdding}>
					<PlusIcon />
					<span className="max-sm:sr-only">Add tile</span>
				</Key>
				<Key
					pressed
					onClick={() => {
						setEditing(false);
						// Done leaves with this bar; the menu that opened edit mode keeps the focus.
						document.querySelector<HTMLButtonElement>('[data-app-menu]')?.focus();
					}}
				>
					<CheckIcon />
					Done
				</Key>
			</span>
		</section>
	);
}
