import { UserIcon } from 'lucide-react';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog';

import { accountStore } from './library-data';

const DEMO_ACCOUNT = { name: 'Demo fan', handle: 'demo' };

/**
 * Sign in, mocked: there is no server yet, so this explains what an account adds and lets a
 * viewer try it with a demo account kept in this browser.
 */
export function AccountDialog({
	open,
	onOpenChange
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const account = accountStore.useValue();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{account ? `Signed in as @${account.handle}` : 'Sign in'}</DialogTitle>
					<DialogDescription>
						{account
							? 'Demo account: your dashboards would sync to every device you sign in on, and you can publish them to the library.'
							: 'An account keeps your dashboards on every device and lets you publish them to the library. Accounts open with the paid launch; try it now with a demo account kept in this browser.'}
					</DialogDescription>
				</DialogHeader>
				<ul className="border-t text-sm">
					{[
						['Free', 'Every ready-made dashboard, 3 of your own, share links'],
						['Pro', 'Any number of dashboards, Pro tiles, publishing']
					].map(([plan, detail]) => (
						<li key={plan} className="flex gap-4 border-b py-2">
							<span className="type-label w-10 shrink-0 pt-0.5">{plan}</span>
							<span>{detail}</span>
						</li>
					))}
				</ul>
				<div className="flex justify-end gap-2">
					{account ? (
						<Key
							onClick={() => {
								accountStore.set(null);
								onOpenChange(false);
							}}
						>
							Sign out
						</Key>
					) : (
						<Key
							pressed
							onClick={() => {
								accountStore.set(DEMO_ACCOUNT);
								onOpenChange(false);
							}}
						>
							Use a demo account
						</Key>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function AccountKey({ className }: { className?: string }) {
	const account = accountStore.useValue();
	const [open, setOpen] = React.useState(false);

	return (
		<>
			<Key
				className={className}
				onClick={() => setOpen(true)}
				aria-label={account ? `Account @${account.handle}` : 'Sign in'}
			>
				<UserIcon />
				<span className="hidden 2xl:inline">{account ? `@${account.handle}` : 'Sign in'}</span>
			</Key>
			<AccountDialog open={open} onOpenChange={setOpen} />
		</>
	);
}
