import { ArrowLeftIcon, EyeOffIcon, FlagIcon, PlusIcon, UploadIcon } from 'lucide-react';
import * as React from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Key } from '@/components/console/keys';
import { DashboardGrid } from '@/features/dashboard/dashboard-grid';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import { type Dashboard, isPreset, PRESETS } from '@/features/dashboard/dashboards';
import { dashboardPath, safeDecode } from '@/features/dashboard/paths';
import { useAccount, useEntitlements } from '@/features/account/account-store';
import { useGoPro } from '@/features/account/go-pro';
import { SignInDialog } from '@/features/account/sign-in';
import { useAddDashboard } from '@/features/dashboard/use-add-dashboard';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';

import { FansSection } from './fans-section';
import { countLibraryAdd, unpublishFromLibrary } from './library-api';
import { LibraryRow, LINK_KEY, Section } from './library-parts';
import { PublishDialog } from './publish-dialog';
import { ReportDialog } from './report-dialog';
import { decodeShare } from './share';
import { useLibraryEntry, useMyLibrary } from './use-library';

/**
 * Every dashboard there is to open or add: the viewer's own, the ready-made ones, and ones other
 * fans published. Adding copies a dashboard; nothing changes for whoever shared it.
 */
export function LibraryPage() {
	const search = useCarriedSearch();
	const account = useAccount();
	const entitlements = useEntitlements();
	const goPro = useGoPro();
	const { dashboards } = useDashboards();
	const { mine, refresh } = useMyLibrary();
	const [signInReason, setSignInReason] = React.useState<string | null>(null);
	const [publishing, setPublishing] = React.useState<Dashboard | null>(null);
	const own = dashboards.filter((dashboard) => !isPreset(dashboard.id));
	const publishingEntry = mine.find((entry) => entry.dashboard.id === publishing?.id) ?? null;

	const choosePublish = (dashboard: Dashboard) => {
		if (account.status !== 'signed-in') {
			setSignInReason(
				'Publishing puts your name on a dashboard, so it needs an account. No password: we email you a link.'
			);
		} else if (!entitlements.publish) {
			toast('Publishing is part of Pro', {
				description: 'Share links work on Free; the library lists Pro dashboards.',
				action: { label: 'Go Pro', onClick: goPro }
			});
		} else {
			setPublishing(dashboard);
		}
	};

	const unpublish = async (id: string, name: string) => {
		try {
			await unpublishFromLibrary(id);
			await refresh();
			toast(`${name} is no longer in the library`);
		} catch {
			toast(`${name} could not be taken out. Try again in a moment.`);
		}
	};

	return (
		<div className="flex flex-col gap-8" data-testid="library">
			<header className="flex flex-col gap-2">
				<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">Library</h1>
				<p className="text-muted-foreground max-w-2xl text-sm">
					Ready-made dashboards and ones other fans built. Open one as it is, or add a copy to make
					it yours: move, resize and swap any tile, then share it with a link.
				</p>
			</header>
			<Section
				title="Yours"
				meta={
					entitlements.ownDashboards === null
						? `${own.length} of any number`
						: `${own.length} of ${entitlements.ownDashboards} on Free`
				}
			>
				{own.length === 0 ? (
					<li className="text-muted-foreground border-b py-3 text-sm">
						Nothing yet. Add one below, or start from an empty dashboard with the + key in the bar.
					</li>
				) : null}
				{own.map((dashboard) => {
					const entry = mine.find((item) => item.dashboard.id === dashboard.id);

					return (
						<LibraryRow
							key={dashboard.id}
							dashboard={dashboard}
							badge={entry ? (entry.hidden ? 'Held back' : 'Published') : undefined}
						>
							{entry ? (
								<Key
									aria-label={`Unpublish ${dashboard.name}`}
									onClick={() => void unpublish(entry.id, dashboard.name)}
								>
									<EyeOffIcon />
									Unpublish
								</Key>
							) : null}
							<Key
								aria-label={`${entry ? 'Update' : 'Publish'} ${dashboard.name}`}
								onClick={() => choosePublish(dashboard)}
							>
								<UploadIcon />
								{entry ? 'Update' : 'Publish'}
							</Key>
							<Link
								to={{ pathname: dashboardPath(dashboard.id), search }}
								aria-label={`Open ${dashboard.name}`}
								className={LINK_KEY}
							>
								Open
							</Link>
						</LibraryRow>
					);
				})}
			</Section>
			<Section title="Ready-made" meta="Edit any of them; Reset brings it back">
				{PRESETS.map((preset) => (
					<LibraryRow key={preset.id} dashboard={preset}>
						<Link to={{ pathname: dashboardPath(preset.id), search }} className={LINK_KEY}>
							Open
						</Link>
					</LibraryRow>
				))}
			</Section>
			<FansSection onNeedSignIn={setSignInReason} />
			<PublishDialog
				dashboard={publishing}
				existing={publishingEntry}
				onOpenChange={(open) => (open ? undefined : setPublishing(null))}
				onPublished={() => void refresh()}
			/>
			<SignInDialog
				open={signInReason !== null}
				onOpenChange={(open) => (open ? undefined : setSignInReason(null))}
				reason={signInReason ?? undefined}
			/>
		</div>
	);
}

/** A dashboard someone else made, live but read-only, with one key to add a copy. */
type Previewed = {
	dashboard: Dashboard;
	/** Its library id when it came from the library: adds are counted and it can be reported. */
	id?: string;
	/** `null` for a library example; a handle for a fan; absent for a shared link. */
	author?: string | null;
};

function previewLabel({ author, id }: Previewed): string {
	if (author) {
		return `Preview, by @${author}`;
	}

	return id ? 'Preview of an example dashboard' : 'Preview, shared with you';
}

function DashboardPreview({
	entry,
	unavailable = false
}: {
	entry: Previewed | null;
	/** The library could not be reached, which is not the same as a link that holds nothing. */
	unavailable?: boolean;
}) {
	const search = useCarriedSearch();
	const add = useAddDashboard();
	const account = useAccount();
	const [reporting, setReporting] = React.useState(false);
	const [signingIn, setSigningIn] = React.useState(false);

	if (!entry) {
		return (
			<div className="text-muted-foreground border border-dashed p-8 text-sm" role="alert">
				{unavailable
					? 'The library is not reachable right now. '
					: 'This link does not hold a dashboard. Ask for a fresh one, or '}
				<Link to={{ pathname: '/library', search }} className="underline">
					browse the library
				</Link>
				.
			</div>
		);
	}

	const { dashboard, id } = entry;

	return (
		<div data-testid="dashboard-preview">
			<section aria-label="Preview" className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4">
				<Link
					to={{ pathname: '/library', search }}
					aria-label="Back to the library"
					className="type-label hover:text-foreground inline-flex h-9 items-center border border-b-2 px-2 sm:h-7"
				>
					<ArrowLeftIcon aria-hidden className="size-3.5" />
				</Link>
				<h1 className="type-wide min-w-0 truncate text-sm font-bold">{dashboard.name}</h1>
				<span className="type-label">{previewLabel(entry)}</span>
				<span className="ml-auto flex gap-2">
					{id ? (
						<Key
							aria-label={`Report ${dashboard.name}`}
							onClick={() =>
								account.status === 'signed-in' ? setReporting(true) : setSigningIn(true)
							}
						>
							<FlagIcon />
							Report
						</Key>
					) : null}
					<Key
						pressed
						onClick={() => {
							if (add(dashboard)) {
								toast(`Added ${dashboard.name} to your dashboards`);

								if (id && account.status === 'signed-in') {
									void countLibraryAdd(id).catch(() => undefined);
								}
							}
						}}
					>
						<PlusIcon />
						Add to my dashboards
					</Key>
				</span>
			</section>
			<DashboardGrid dashboard={dashboard} editing={false} onChange={() => undefined} />
			<ReportDialog
				entry={reporting && id ? { id, name: dashboard.name } : null}
				onOpenChange={(open) => (open ? undefined : setReporting(false))}
			/>
			<SignInDialog
				open={signingIn}
				onOpenChange={setSigningIn}
				reason="Reports need an account, so one person cannot hide a dashboard alone."
			/>
		</div>
	);
}

export function LibraryEntryPage() {
	const { entryId } = useParams();
	const { status, entry } = useLibraryEntry(entryId ? safeDecode(entryId) : null);

	if (status === 'loading') {
		return <output className="text-muted-foreground block p-8 text-sm">Loading</output>;
	}

	return (
		<DashboardPreview
			entry={entry ? { dashboard: entry.dashboard, id: entry.id, author: entry.author } : null}
			unavailable={status === 'unavailable'}
		/>
	);
}

/** /shared?d=…: a dashboard carried whole in its link. */
export function SharedPage() {
	const [searchParams] = useSearchParams();
	const code = searchParams.get('d');
	const dashboard = code ? decodeShare(code) : null;

	return <DashboardPreview entry={dashboard ? { dashboard } : null} />;
}
