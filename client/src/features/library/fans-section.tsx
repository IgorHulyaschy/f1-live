import { type LibrarySort } from '@f1-live/shared/library';
import { FlagIcon, PlusIcon } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { Key, KeyGroup } from '@/components/console/keys';
import { useAccount } from '@/features/account/account-store';
import { useAddDashboard } from '@/features/dashboard/use-add-dashboard';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';

import { countLibraryAdd } from './library-api';
import { LibraryRow, LINK_KEY, Section } from './library-parts';
import { ReportDialog } from './report-dialog';
import { useDebounced, useLibraryListing } from './use-library';

const SORTS: readonly { value: LibrarySort; label: string }[] = [
	{ value: 'popular', label: 'Most added' },
	{ value: 'new', label: 'Newest' }
];

/**
 * What other fans published: search, tags, order, preview, add a copy and report. The examples
 * the library ships with are marked as such, and come first only while they are the most added.
 */
export function FansSection({ onNeedSignIn }: { onNeedSignIn: (reason: string) => void }) {
	const search = useCarriedSearch();
	const account = useAccount();
	const add = useAddDashboard();
	const [typed, setTyped] = React.useState('');
	const [tag, setTag] = React.useState('');
	const [sort, setSort] = React.useState<LibrarySort>('popular');
	const [reporting, setReporting] = React.useState<{ id: string; name: string } | null>(null);
	const q = useDebounced(typed, 250);
	const listing = useLibraryListing({ q, tag, sort });
	const signedIn = account.status === 'signed-in';

	const controls = (
		<div className="flex flex-wrap items-end gap-x-4 gap-y-3 py-3">
			<label className="flex min-w-48 flex-1 flex-col gap-1 sm:max-w-xs">
				<span className="type-label">Search</span>
				<input
					type="search"
					value={typed}
					onChange={(event) => setTyped(event.target.value)}
					placeholder="Name, tag or @handle"
					className="border-rule-strong focus-visible:border-foreground placeholder:text-muted-foreground h-9 w-full border-b-2 bg-transparent text-sm outline-none"
					data-testid="library-search"
				/>
			</label>
			<KeyGroup options={SORTS} value={sort} onChange={setSort} label="Order" />
			{listing.tags.length > 0 ? (
				<fieldset className="flex flex-wrap gap-1.5">
					<legend className="sr-only">Tags</legend>
					<Key pressed={tag === ''} onClick={() => setTag('')}>
						All
					</Key>
					{listing.tags.slice(0, 8).map((name) => (
						<Key
							key={name}
							pressed={tag === name}
							aria-pressed={tag === name}
							onClick={() => setTag(tag === name ? '' : name)}
						>
							{name}
						</Key>
					))}
				</fieldset>
			) : null}
		</div>
	);

	return (
		<>
			<Section
				title="From fans"
				meta="Preview one, or add a copy to make it yours"
				controls={controls}
			>
				{listing.status === 'unavailable' ? (
					<li className="text-muted-foreground border-b py-3 text-sm">
						<output>
							Fan dashboards come from the server, which is not reachable from here. The ready-made
							ones and share links work as always.
						</output>
					</li>
				) : null}
				{listing.status === 'loading' && listing.entries.length === 0 ? (
					<li className="text-muted-foreground border-b py-3 text-sm">
						<output>Loading</output>
					</li>
				) : null}
				{listing.status === 'ready' && listing.entries.length === 0 ? (
					<li className="text-muted-foreground border-b py-3 text-sm">
						<output>Nothing matches. Try another word or tag.</output>
					</li>
				) : null}
				{listing.entries.map((entry) => (
					<LibraryRow
						key={entry.id}
						dashboard={entry.dashboard}
						by={entry.author ?? undefined}
						badge={entry.author === null ? 'Example' : entry.mine ? 'Yours' : undefined}
						description={entry.description}
						tags={entry.tags}
						adds={entry.adds}
					>
						<Link
							to={{ pathname: `/library/${encodeURIComponent(entry.id)}`, search }}
							className={LINK_KEY}
						>
							Preview
						</Link>
						<Key
							aria-label={`Add ${entry.dashboard.name}`}
							onClick={() => {
								if (add(entry.dashboard)) {
									toast(`Added ${entry.dashboard.name} to your dashboards`);

									if (signedIn) {
										void countLibraryAdd(entry.id).catch(() => undefined);
									}
								}
							}}
						>
							<PlusIcon />
							Add
						</Key>
						{entry.mine ? null : (
							<Key
								aria-label={`Report ${entry.dashboard.name}`}
								title="Report"
								onClick={() =>
									signedIn
										? setReporting({ id: entry.id, name: entry.dashboard.name })
										: onNeedSignIn(
												'Reports need an account, so one person cannot hide a dashboard alone.'
											)
								}
							>
								<FlagIcon />
							</Key>
						)}
					</LibraryRow>
				))}
				{listing.hasMore ? (
					<li className="py-3">
						<Key onClick={listing.loadMore} disabled={listing.loadingMore}>
							{listing.loadingMore ? 'Loading' : 'Show more'}
						</Key>
					</li>
				) : null}
			</Section>
			<ReportDialog
				entry={reporting}
				onOpenChange={(open) => (open ? undefined : setReporting(null))}
			/>
		</>
	);
}
