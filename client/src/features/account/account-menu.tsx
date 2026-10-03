import { BellIcon, LogOutIcon, SparklesIcon, UserIcon } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Key } from '@/components/console/keys';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';

import { signOut, useAccount } from './account-store';
import { useGoPro } from './go-pro';

const SignInDialog = React.lazy(async () => ({
	default: (await import('./sign-in')).SignInDialog
}));

export async function signOutWithNotice(): Promise<void> {
	try {
		await signOut();
		toast('Signed out', { description: 'Your dashboards stay in this browser.' });
	} catch {
		toast('Could not sign out', { description: 'The accounts server did not answer.' });
	}
}

/** The account key in the bar: sign in, or the signed-in account's menu. */
export function AccountKey({ className }: { className?: string }) {
	const account = useAccount();
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const goPro = useGoPro();
	const [signingIn, setSigningIn] = React.useState(false);

	if (account.status !== 'signed-in') {
		return (
			<>
				<Key
					className={className}
					onClick={() => setSigningIn(true)}
					aria-label="Sign in"
					disabled={account.status === 'loading'}
				>
					<UserIcon />
					<span className="hidden 2xl:inline">Sign in</span>
				</Key>
				{signingIn ? (
					<React.Suspense fallback={null}>
						<SignInDialog open onOpenChange={setSigningIn} />
					</React.Suspense>
				) : null}
			</>
		);
	}

	const { user, plan } = account.me;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Key className={className} aria-label={`Account ${user.email}`} data-testid="account-menu">
					<UserIcon />
					<span className="hidden max-w-40 truncate normal-case 2xl:inline">{user.email}</span>
					{plan === 'pro' ? <span>Pro</span> : null}
				</Key>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>
					<span className="block truncate font-medium">{user.email}</span>
					<span className="type-label block pt-0.5">{plan === 'pro' ? 'Pro' : 'Free'}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => void navigate({ pathname: '/account', search })}>
					<UserIcon />
					Account and billing
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => void navigate({ pathname: '/alerts', search })}>
					<BellIcon />
					Alerts
				</DropdownMenuItem>
				{plan === 'pro' ? null : (
					<DropdownMenuItem onSelect={goPro}>
						<SparklesIcon />
						Go Pro
					</DropdownMenuItem>
				)}
				<DropdownMenuItem onSelect={() => void signOutWithNotice()}>
					<LogOutIcon />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Back from a sign-in link: say who is signed in, once, and tidy the address. */
export function useSignInReturn(): void {
	const account = useAccount();
	const [searchParams, setSearchParams] = useSearchParams();
	const returned = searchParams.has('signedin');

	React.useEffect(() => {
		if (!returned || account.status === 'loading') {
			return;
		}

		if (account.status === 'signed-in') {
			toast(`Signed in as ${account.me.user.email}`, {
				id: 'signed-in',
				description: 'Dashboards in this browser now sync to your account.'
			});
		}

		setSearchParams(
			(params) => {
				params.delete('signedin');

				return params;
			},
			{ replace: true }
		);
	}, [returned, account, setSearchParams]);
}

const SyncRunner = React.lazy(() => import('./sync-runner'));

/** The session's background work in the full app: dashboard sync and the sign-in greeting. */
export function AccountSession() {
	const account = useAccount();

	useSignInReturn();

	return account.status === 'signed-in' ? (
		<React.Suspense fallback={null}>
			<SyncRunner />
		</React.Suspense>
	) : null;
}

/** Phones keep the account in the footer, next to the theme. */
export function AccountFooterKey() {
	const account = useAccount();
	const navigate = useNavigate();
	const search = useCarriedSearch();

	return (
		<Key onClick={() => void navigate({ pathname: '/account', search })}>
			{account.status === 'signed-in' ? 'Account' : 'Sign in'}
		</Key>
	);
}
