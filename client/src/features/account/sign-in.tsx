import { PLAN_ENTITLEMENTS } from '@f1-live/shared/plans';
import { MailIcon } from 'lucide-react';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog';

import { useAccount, useAccountsConfig } from './account-store';
import { AccountsError, sendSignInLink, socialSignInUrl } from './api';

type Step =
	| { kind: 'idle' }
	| { kind: 'sending' }
	| { kind: 'sent'; email: string }
	| { kind: 'failed'; message: string };

/** Where a sign-in link lands: this page, flagged so the app can say who signed in. */
function returnUrl(): string {
	const url = new URL(window.location.href);

	url.searchParams.set('signedin', '1');
	url.searchParams.delete('error');

	return url.toString();
}

function failure(cause: unknown): string {
	return cause instanceof AccountsError && cause.kind === 'refused'
		? cause.message
		: 'Sign-in is not reachable right now. Try again in a moment.';
}

/** Email first: no password, one link. Google and Apple when the server has them set up. */
export function SignInForm() {
	const account = useAccount();
	const config = useAccountsConfig();
	const [email, setEmail] = React.useState('');
	const [step, setStep] = React.useState<Step>({ kind: 'idle' });

	if (account.status === 'unavailable') {
		return (
			<output className="text-muted-foreground block border-l-2 py-1 pl-3 text-sm">
				Sign-in is not available here right now. Your dashboards are saved in this browser and share
				links work as always.
			</output>
		);
	}

	const send = async (address: string) => {
		setStep({ kind: 'sending' });

		try {
			await sendSignInLink(address, returnUrl());
			setStep({ kind: 'sent', email: address });
		} catch (error) {
			setStep({ kind: 'failed', message: failure(error) });
		}
	};

	const social = async (provider: 'google' | 'apple') => {
		try {
			window.location.assign(await socialSignInUrl(provider, returnUrl()));
		} catch (error) {
			setStep({ kind: 'failed', message: failure(error) });
		}
	};

	if (step.kind === 'sent') {
		return (
			<output className="flex flex-col gap-3" data-testid="sign-in-sent">
				<p className="type-wide flex items-center gap-2 text-sm font-bold">
					<MailIcon aria-hidden className="size-4" />
					Check your inbox
				</p>
				<p className="text-muted-foreground text-sm">
					We sent a sign-in link to{' '}
					<span className="text-foreground font-medium">{step.email}</span>. It works once, for 5
					minutes, on the device you open it on.
				</p>
				{config?.devMailbox ? (
					<p className="type-label">Development server: the link is in its log</p>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Key onClick={() => setStep({ kind: 'idle' })}>Use another email</Key>
					<Key onClick={() => void send(step.email)}>Send again</Key>
				</div>
			</output>
		);
	}

	const providers = config
		? (['google', 'apple'] as const).filter((provider) => config.providers[provider])
		: [];

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				void send(email.trim());
			}}
		>
			<label className="flex flex-col gap-1">
				<span className="type-label">Email</span>
				<input
					type="email"
					required
					autoComplete="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					placeholder="you@example.com"
					className="border-rule-strong focus-visible:border-foreground placeholder:text-muted-foreground h-9 w-full border-b-2 bg-transparent text-sm outline-none"
				/>
			</label>
			<div className="flex flex-wrap items-center gap-2">
				<Key type="submit" pressed disabled={step.kind === 'sending'}>
					{step.kind === 'sending' ? 'Sending' : 'Email me a link'}
				</Key>
				{providers.map((provider) => (
					<Key key={provider} onClick={() => void social(provider)}>
						Continue with {provider === 'google' ? 'Google' : 'Apple'}
					</Key>
				))}
			</div>
			{step.kind === 'failed' ? (
				<p className="text-destructive text-sm" role="alert">
					{step.message}
				</p>
			) : null}
		</form>
	);
}

const FREE = PLAN_ENTITLEMENTS.free;

/** The plans in one table, worded from the same entitlements the server enforces. */
export const PLAN_LINES = [
	[
		'Free',
		`Every ready-made dashboard, ${FREE.ownDashboards ?? 'any number'} of your own, share links`
	],
	['Pro', 'Any number of dashboards, Pro tiles, publishing to the library']
] as const;

export function PlanLines() {
	return (
		<ul className="border-t text-sm">
			{PLAN_LINES.map(([plan, detail]) => (
				<li key={plan} className="flex gap-4 border-b py-2">
					<span className="type-label w-10 shrink-0 pt-0.5">{plan}</span>
					<span>{detail}</span>
				</li>
			))}
		</ul>
	);
}

export function SignInDialog({
	open,
	onOpenChange,
	reason
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Why signing in is asked for here, when it is not the viewer's own idea. */
	reason?: string;
}) {
	const account = useAccount();
	const signedIn = account.status === 'signed-in';

	// Signing in finishes in the tab the link opens; this one closes the dialog when it hears.
	React.useEffect(() => {
		if (open && signedIn) {
			onOpenChange(false);
		}
	}, [open, signedIn, onOpenChange]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Sign in</DialogTitle>
					<DialogDescription>
						{reason ??
							'Your dashboards on every device you sign in on, and Pro when you want it. No password: we email you a link.'}
					</DialogDescription>
				</DialogHeader>
				<SignInForm />
				<PlanLines />
			</DialogContent>
		</Dialog>
	);
}
