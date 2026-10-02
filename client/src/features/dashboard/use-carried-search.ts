import { useSearchParams } from 'react-router';

/** The search to carry to another dashboard or window: race state, not edit mode or a shared link. */
export function useCarriedSearch(): string {
	const [searchParams] = useSearchParams();
	const params = new URLSearchParams(searchParams);

	params.delete('edit');
	params.delete('d');

	return params.toString();
}
