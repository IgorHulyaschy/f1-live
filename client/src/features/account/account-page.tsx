import { DownloadIcon, ExternalLinkIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Key, KeyGroup } from '@/components/console/keys';
import { Field } from '@/components/console/panel';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog';

import { signOutWithNotice } from './account-menu';
import {
	forgetAccount,
	readAccount,
	refreshAccount,
	useAccount,
	useAccountsConfig
} from './account-store';
import {
	type AccountsConfig,
	type BillingInterval,
	billingPortalUrl,
	checkoutUrl,
	deleteAccount,
	downloadAccountData,
	type Me
} from './api';
import { PlanLines, SignInForm } from './sign-in';

const INTERVALS = [
	{ value: 'month', label: 'Monthly' },
	{ value: 'year', label: 'Yearly' }
] as const;

/** A webhook can trail the return from checkout by a few seconds. */
const CHECKOUT_POLLS = 10;

const CHECKOUT_POLL_MS = 1000;

const SIGN_IN_ERRORS = new Map([
	['INVALID_TOKEN', 'That sign-in link has expired or was already used. Send yourself a new one.'],
	['EXPIRED_TOKEN', 'That sign-in link has expired. Send yourself a new one.']
]);

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(new Date(iso));
}

function priceLabel(config: AccountsConfig | null, interval: BillingInterval): string {
	const price = config?.payments.prices.find((entry) => entry.interval === interval);

	if (!price?.amount || !price.currency) {
		return 'Shown at checkout';
	}

	const amount = new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: price.currency.toUpperCase()
	}).format(price.amount / 100);

	return `${amount} a ${interval}`;
}

function Section({
	title,
	meta,
	children
}: {
	title: string;
	meta?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section aria-label={title} className="flex flex-col gap-4">
			<header className="border-rule-strong flex flex-wrap items-baseline gap-x-4 border-b-2 pb-1.5">
				<h2 className="type-wide text-xs font-bold">{title}</h2>
				{meta ? <span className="type-label">{meta}</span> : null}
			</header>
			{children}
		</section>
	);
}

/** Back from checkout: wait for the payment to land, then say what happened, once. */
function useCheckoutReturn(): void {
	const [searchParams, setSearchParams] = useSearchParams();
	const outcome = searchParams.get('checkout');

	React.useEffect(() => {
		if (!outcome) {
			return;
		}

		let cancelled = false;

		const clear = () =>
			setSearchParams(
				(params) => {
					params.delete('checkout');

					return params;
				},
				{ replace: true }
			);

		if (outcome !== 'success') {
			toast('Checkout cancelled', { id: 'checkout', description: 'Nothing was charged.' });
			clear();

			return;
		}

		const wait = async () => {
			for (let poll = 0; poll < CHECKOUT_POLLS; poll += 1) {
				if (cancelled) {
					return;
				}

				await refreshAccount();

				const account = readAccount();

				if (account.status === 'signed-in' && account.me.plan === 'pro') {
					break;
				}

				await new Promise((resolve) => window.setTimeout(resolve, CHECKOUT_POLL_MS));
			}

			if (!cancelled) {
				toast('Pro is on', {
					id: 'checkout',
					description: 'Any number of dashboards, Pro tiles and publishing.'
				});
				clear();
			}
		};

		void wait();

		return () => {
			cancelled = true;
		};
	}, [outcome, setSearchParams]);
}

function PlanSection({ me, focus }: { me: Me; focus: boolean }) {
	const config = useAccountsConfig();
	const [interval, setBillingInterval] = React.useState<BillingInterval>('month');
	const [busy, setBusy] = React.useState(false);
	const goPro = React.useRef<HTMLButtonElement>(null);
	const { plan, subscription } = me;

	React.useEffect(() => {
		if (focus) {
			goPro.current?.focus();
			goPro.current?.scrollIntoView({ block: 'center' });
		}
	}, [focus]);

	const open = async (target: () => Promise<string>) => {
		setBusy(true);

		try {
			window.location.assign(await target());
		} catch {
			setBusy(false);
			toast('The payment provider did not answer', { description: 'Nothing changed. Try again.' });
		}
	};

	const status = subscription
		? subscription.status === 'canceled'
			? `Ended${subscription.currentPeriodEnd ? ` ${formatDate(subscription.currentPeriodEnd)}` : ''}`
			: subscription.status === 'past_due'
				? 'Payment failed, retrying'
				: subscription.currentPeriodEnd
					? `${subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'} ${formatDate(subscription.currentPeriodEnd)}`
					: 'Active'
		: null;

	return (
		<Section title="Plan" meta={plan === 'pro' ? 'Pro' : 'Free'}>
			<div className="flex flex-wrap gap-x-10 gap-y-3">
				<Field label="Plan">{plan === 'pro' ? 'Pro' : 'Free'}</Field>
				{subscription ? (
					<Field label="Billed">{subscription.interval === 'year' ? 'Yearly' : 'Monthly'}</Field>
				) : null}
				{status ? <Field label="Status">{status}</Field> : null}
			</div>
			<PlanLines />
			{plan === 'pro' ? (
				me.billing.portal ? (
					<div className="flex flex-wrap items-center gap-3">
						<Key disabled={busy} onClick={() => void open(billingPortalUrl)}>
							<ExternalLinkIcon />
							Manage billing
						</Key>
						<span className="text-muted-foreground text-xs">
							Change the plan, update the card, see invoices or cancel.
						</span>
					</div>
				) : null
			) : (
				<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
					<KeyGroup
						label="Billing"
						options={INTERVALS}
						value={interval}
						onChange={setBillingInterval}
					/>
					<Field label="Price" className="min-w-36">
						{priceLabel(config, interval)}
					</Field>
					<Key
						ref={goPro}
						pressed
						disabled={busy}
						onClick={() => void open(() => checkoutUrl(interval))}
						data-testid="go-pro"
					>
						<SparklesIcon />
						Go Pro
					</Key>
					{config?.payments.provider === 'fake' ? (
						<span className="type-label">Test payments: no card, no charge</span>
					) : null}
				</div>
			)}
		</Section>
	);
}

function DeleteAccountDialog({
	me,
	open,
	onOpenChange
}: {
	me: Me;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const [typed, setTyped] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const matches = typed.trim().toLowerCase() === me.user.email.toLowerCase();

	const confirm = async () => {
		setBusy(true);

		try {
			await deleteAccount(typed.trim());
			forgetAccount();
			onOpenChange(false);
			void navigate('/');
			toast('Account deleted', {
				description: 'It is gone from our server. Dashboards in this browser stay here.'
			});
		} catch {
			setBusy(false);
			toast('The account was not deleted', {
				description: 'Ending the subscription failed, so nothing was removed. Try again.'
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Delete your account?</DialogTitle>
					<DialogDescription>
						This deletes the account, its sign-ins and every dashboard synced to it
						{me.plan === 'pro' ? ', and ends Pro now' : ''}. It cannot be undone. Dashboards saved
						in this browser stay here.
					</DialogDescription>
				</DialogHeader>
				<label className="flex flex-col gap-1">
					<span className="type-label">Type {me.user.email} to confirm</span>
					<input
						type="email"
						value={typed}
						onChange={(event) => setTyped(event.target.value)}
						autoComplete="off"
						aria-label="Email to confirm"
						className="border-rule-strong focus-visible:border-foreground h-9 w-full border-b-2 bg-transparent text-sm outline-none"
					/>
				</label>
				<div className="flex flex-wrap justify-end gap-2">
					<Key onClick={() => onOpenChange(false)}>Keep my account</Key>
					<Key pressed disabled={!matches || busy} onClick={() => void confirm()}>
						<Trash2Icon />
						Delete account
					</Key>
				</div>
			</DialogContent>
		</Dialog>
	);
}

async function exportData(): Promise<void> {
	try {
		const url = URL.createObjectURL(await downloadAccountData());
		const link = document.createElement('a');

		link.href = url;
		link.download = `pitwall-account-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
	} catch {
		toast('The export failed', { description: 'The accounts server did not answer.' });
	}
}

function SignedIn({ me, focusPlan }: { me: Me; focusPlan: boolean }) {
	const [deleting, setDeleting] = React.useState(false);

	return (
		<>
			<Section title="Signed in">
				<div className="flex flex-wrap items-end gap-x-10 gap-y-3">
					<Field label="Email">{me.user.email}</Field>
					<Field label="Since">{formatDate(me.user.createdAt)}</Field>
					<Key className="ml-auto" onClick={() => void signOutWithNotice()}>
						Sign out
					</Key>
				</div>
				<p className="text-muted-foreground text-sm">
					Dashboards you make or edit sync to this account and show up wherever you sign in. Share
					links keep working for anyone, signed in or not.
				</p>
			</Section>
			<PlanSection me={me} focus={focusPlan} />
			<Section title="Your data">
				<p className="text-muted-foreground max-w-2xl text-sm">
					Download everything the account holds as one file: the account, its sign-ins, sessions,
					subscription and dashboards. Or delete it all.
				</p>
				<div className="flex flex-wrap gap-2">
					<Key onClick={() => void exportData()}>
						<DownloadIcon />
						Export my data
					</Key>
					<Key onClick={() => setDeleting(true)}>
						<Trash2Icon />
						Delete account
					</Key>
				</div>
			</Section>
			<DeleteAccountDialog me={me} open={deleting} onOpenChange={setDeleting} />
		</>
	);
}

/** `/account`: sign in, the plan and billing, and the viewer's data. */
export function AccountPage() {
	const account = useAccount();
	const [searchParams] = useSearchParams();
	const upgrading = searchParams.has('upgrade');
	const signInError = searchParams.get('error');

	useCheckoutReturn();

	return (
		<div className="flex max-w-3xl flex-col gap-8" data-testid="account-page">
			<header className="flex flex-col gap-2">
				<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">Account</h1>
				<p className="text-muted-foreground max-w-2xl text-sm">
					An account keeps your dashboards on every device and holds Pro. Everything also works
					without one, in this browser.
				</p>
			</header>
			{account.status === 'signed-in' ? (
				<SignedIn me={account.me} focusPlan={upgrading} />
			) : account.status === 'loading' ? null : (
				<>
					<Section title="Sign in">
						{upgrading ? (
							<p className="text-sm">
								Sign in first: Pro belongs to your account, on every device.
							</p>
						) : null}
						{signInError ? (
							<p className="text-destructive text-sm" role="alert">
								{SIGN_IN_ERRORS.get(signInError) ??
									'Signing in did not work. Send yourself a new link.'}
							</p>
						) : null}
						<SignInForm />
					</Section>
					<Section title="Plans">
						<PlanLines />
					</Section>
				</>
			)}
		</div>
	);
}
