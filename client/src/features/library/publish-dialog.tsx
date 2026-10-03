import { DESCRIPTION_MAX, type LibraryEntry, TAGS_MAX } from '@f1-live/shared/library';
import * as React from 'react';
import { toast } from 'sonner';

import { Key } from '@/components/console/keys';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog';

import { refreshAccount, useAccount } from '../account/account-store';
import { AccountsError } from '../account/api';
import type { Dashboard } from '../dashboard/dashboards';
import { checkHandle, claimHandle, type HandleCheck, publishToLibrary } from './library-api';
import { handleProblem, parseTags, tagLineProblem } from './library-form';
import { useDebounced } from './use-library';

const FIELD =
	'border-rule-strong focus-visible:border-foreground placeholder:text-muted-foreground w-full border-b-2 bg-transparent text-sm outline-none';

/** Who is publishing: the handle is picked here, once, with the server saying while they type. */
function HandleStep({ onClaimed }: { onClaimed: () => void }) {
	const [typed, setTyped] = React.useState('');

	const [checked, setChecked] = React.useState<{
		handle: string;
		result: HandleCheck | null;
	} | null>(null);

	const [failure, setFailure] = React.useState<string | null>(null);
	const asked = useDebounced(typed.trim(), 300);

	React.useEffect(() => {
		if (!asked) {
			return;
		}

		let current = true;

		void (async () => {
			try {
				const result = await checkHandle(asked);

				if (current) {
					setChecked({ handle: asked, result });
				}
			} catch {
				if (current) {
					setChecked({ handle: asked, result: null });
				}
			}
		})();

		return () => {
			current = false;
		};
	}, [asked]);

	// What the server said about what is typed now; "checking" until it has said it.
	const verdict: HandleCheck | 'checking' | null = !typed.trim()
		? null
		: checked?.handle === typed.trim()
			? checked.result
			: 'checking';

	const problem = verdict && verdict !== 'checking' ? handleProblem(verdict) : null;

	const claim = async () => {
		try {
			await claimHandle(typed);
			await refreshAccount();
			onClaimed();
		} catch (cause) {
			setFailure(cause instanceof AccountsError ? cause.message : 'The library is not reachable.');
		}
	};

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				void claim();
			}}
		>
			<label className="flex flex-col gap-1">
				<span className="type-label">Your handle</span>
				<input
					value={typed}
					onChange={(event) => {
						setTyped(event.target.value);
						setFailure(null);
					}}
					autoComplete="off"
					autoCapitalize="none"
					spellCheck={false}
					maxLength={21}
					placeholder="boxboxbox"
					aria-describedby="handle-note"
					className={`${FIELD} h-9 font-mono`}
					data-testid="handle-input"
				/>
			</label>
			<output id="handle-note" className="text-muted-foreground block min-h-5 text-sm">
				{problem ??
					failure ??
					(verdict === 'available'
						? `@${typed.trim().replace(/^@/, '').toLowerCase()} is free`
						: 'Shown as “by @handle” on everything you publish. You pick it once; it is not your email.')}
			</output>
			<div>
				<Key type="submit" pressed disabled={verdict !== 'available'}>
					Use this handle
				</Key>
			</div>
		</form>
	);
}

function DescribeStep({
	dashboard,
	existing,
	onPublished
}: {
	dashboard: Dashboard;
	existing: LibraryEntry | null;
	onPublished: (entry: LibraryEntry) => void;
}) {
	const [description, setDescription] = React.useState(existing?.description ?? '');
	const [tagLine, setTagLine] = React.useState(existing?.tags.join(', ') ?? '');
	const [sending, setSending] = React.useState(false);
	const [failure, setFailure] = React.useState<string | null>(null);
	const tagProblem = tagLineProblem(tagLine);

	const publish = async () => {
		setSending(true);
		setFailure(null);

		try {
			onPublished(
				await publishToLibrary({
					dashboard,
					description: description.trim(),
					tags: parseTags(tagLine)
				})
			);
		} catch (cause) {
			setFailure(
				cause instanceof AccountsError && cause.kind === 'refused'
					? cause.message
					: 'The library is not reachable. Try again in a moment.'
			);
			setSending(false);
		}
	};

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				void publish();
			}}
		>
			<label className="flex flex-col gap-1">
				<span className="type-label">
					What it is for{' '}
					<span className="font-mono">
						{description.length}/{DESCRIPTION_MAX}
					</span>
				</span>
				<textarea
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					maxLength={DESCRIPTION_MAX}
					rows={3}
					placeholder="Who it suits and what it shows"
					className={`${FIELD} resize-none py-1.5`}
					data-testid="publish-description"
				/>
			</label>
			<label className="flex flex-col gap-1">
				<span className="type-label">Tags, separated by commas (up to {TAGS_MAX})</span>
				<input
					value={tagLine}
					onChange={(event) => setTagLine(event.target.value)}
					placeholder="TV, Race day"
					className={`${FIELD} h-9`}
					data-testid="publish-tags"
				/>
			</label>
			<p className="text-muted-foreground text-sm">
				The library keeps a copy of {dashboard.name} as it is now. Change yours later and publish
				again to update it; unpublish any time.
			</p>
			{tagProblem || failure ? (
				<p className="text-destructive text-sm" role="alert">
					{tagProblem ?? failure}
				</p>
			) : null}
			<div>
				<Key type="submit" pressed disabled={sending || tagProblem !== null}>
					{existing ? 'Update in library' : 'Publish'}
				</Key>
			</div>
		</form>
	);
}

/**
 * Publishing, start to finish: choose the handle that signs it (the first time), describe the
 * dashboard, publish. The server checks the plan and the words again.
 */
export function PublishDialog({
	dashboard,
	existing,
	onOpenChange,
	onPublished
}: {
	/** The dashboard to publish; the dialog is open while there is one. */
	dashboard: Dashboard | null;
	existing: LibraryEntry | null;
	onOpenChange: (open: boolean) => void;
	onPublished: () => void;
}) {
	const account = useAccount();
	const handle = account.status === 'signed-in' ? account.me.handle : null;
	const [claimed, setClaimed] = React.useState(false);

	return (
		<Dialog open={dashboard !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="publish-dialog">
				<DialogHeader>
					<DialogTitle>
						{handle || claimed ? `Publish ${dashboard?.name ?? ''}` : 'Choose a handle'}
					</DialogTitle>
					<DialogDescription>
						{handle || claimed
							? `Fans can preview it and add a copy, signed @${handle ?? 'you'}.`
							: 'Fans see this name next to what you publish.'}
					</DialogDescription>
				</DialogHeader>
				{dashboard ? (
					handle || claimed ? (
						<DescribeStep
							dashboard={dashboard}
							existing={existing}
							onPublished={(entry) => {
								onOpenChange(false);
								onPublished();
								toast(`${entry.dashboard.name} is in the library`, {
									description: 'Fans can preview it and add a copy.'
								});
							}}
						/>
					) : (
						<HandleStep onClaimed={() => setClaimed(true)} />
					)
				) : null}
			</DialogContent>
		</Dialog>
	);
}
