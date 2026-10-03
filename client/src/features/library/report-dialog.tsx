import { REPORT_REASONS, type ReportReason } from '@f1-live/shared/library';
import * as React from 'react';
import { toast } from 'sonner';

import { Key, KeyGroup } from '@/components/console/keys';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog';

import { AccountsError } from '../account/api';
import { reportLibraryEntry } from './library-api';

const REASONS: Record<ReportReason, string> = {
	spam: 'Spam or an advert',
	offensive: 'Offensive name or text',
	copyright: 'Copies someone else’s work',
	other: 'Something else'
};

/** Asks why, and tells the library; enough different viewers hide a dashboard until it is looked at. */
export function ReportDialog({
	entry,
	onOpenChange
}: {
	/** The entry being reported, as its id and name; the dialog is open while there is one. */
	entry: { id: string; name: string } | null;
	onOpenChange: (open: boolean) => void;
}) {
	const [reason, setReason] = React.useState<ReportReason>('other');
	const [sending, setSending] = React.useState(false);

	const send = async () => {
		if (!entry) {
			return;
		}

		setSending(true);

		try {
			await reportLibraryEntry(entry.id, reason);
			toast('Thanks, we will look at it', {
				description: 'Dashboards that enough fans report are held back until someone has checked.'
			});
			onOpenChange(false);
		} catch (cause) {
			toast(cause instanceof AccountsError ? cause.message : 'The report did not go through');
		} finally {
			setSending(false);
		}
	};

	return (
		<Dialog
			open={entry !== null}
			onOpenChange={(open) => {
				onOpenChange(open);
				setReason('other');
			}}
		>
			<DialogContent className="sm:max-w-md" data-testid="report-dialog">
				<DialogHeader>
					<DialogTitle>Report {entry?.name}</DialogTitle>
					<DialogDescription>What is wrong with it?</DialogDescription>
				</DialogHeader>
				<KeyGroup
					label="Reason"
					value={reason}
					onChange={setReason}
					options={REPORT_REASONS.map((option) => ({ value: option, label: REASONS[option] }))}
				/>
				<div>
					<Key pressed disabled={sending} onClick={() => void send()}>
						Send report
					</Key>
				</div>
			</DialogContent>
		</Dialog>
	);
}
