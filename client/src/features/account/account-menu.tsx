import * as React from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { signOut, useAccount } from './account-store';

export async function signOutWithNotice(): Promise<void> {
	try {
		await signOut();
		toast('Signed out', { description: 'Your dashboards stay in this browser.' });
	} catch {
		toast('Could not sign out', { description: 'The accounts server did not answer.' });
	}
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
