import { useSearchParams } from 'react-router';

/** The search to carry to another dashboard or window: race state, but not edit mode. */
export function useCarriedSearch(): string {
	const [searchParams] = useSearchParams();
	const params = new URLSearchParams(searchParams);

	params.delete('edit');

	return params.toString();
}
