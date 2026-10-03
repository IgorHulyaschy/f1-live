import { useNavigate } from 'react-router';

import { useCarriedSearch } from '@/features/dashboard/use-carried-search';

/** The account page, opened at the plan: where every upgrade prompt leads. */
export function useGoPro(): () => void {
	const navigate = useNavigate();
	const search = new URLSearchParams(useCarriedSearch());

	search.set('upgrade', '1');

	return () => void navigate({ pathname: '/account', search: search.toString() });
}
