import * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Sonner's own phone width, where toasts run the full width. */
const PHONE = '(max-width: 600px)';

function subscribe(onChange: () => void): () => void {
	const query = window.matchMedia(PHONE);

	query.addEventListener('change', onChange);

	return () => query.removeEventListener('change', onChange);
}

function usePhone(): boolean {
	return React.useSyncExternalStore(
		subscribe,
		() => window.matchMedia(PHONE).matches,
		() => false
	);
}

/**
 * Toasts keep clear of the transport and the scrubber: under the top bar on a wide screen, where
 * the Replay tile is not, and above the pit board on a phone, whose transport heads the page.
 */
function Toaster({ theme = 'dark', ...props }: ToasterProps) {
	const phone = usePhone();

	return (
		<Sonner
			theme={theme}
			style={{ '--border-radius': '0' }}
			position={phone ? 'bottom-center' : 'top-right'}
			offset={{ top: 'calc(max(48px, 2.5rem) + 0.75rem)' }}
			mobileOffset={{ bottom: '4.5rem' }}
			{...props}
		/>
	);
}

export { Toaster };
