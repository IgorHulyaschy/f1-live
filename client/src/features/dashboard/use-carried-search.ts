import { useSearchParams } from 'react-router';

import { DRILL_PARAMS } from '@/features/drill/drill-url';

/**
 * The search to carry to another dashboard or window: race state, not edit mode, a shared link or
 * an open driver or lap view.
 */
export function useCarriedSearch(): string {
	const [searchParams] = useSearchParams();
	const params = new URLSearchParams(searchParams);

	params.delete('edit');
	params.delete('d');

	for (const name of DRILL_PARAMS) {
		params.delete(name);
	}

	return params.toString();
}
