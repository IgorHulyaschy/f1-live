import { useEffect } from 'react';

export function useRemoveMuiWatermark(ref: React.RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		if (!ref?.current) return;

		[...ref.current.querySelectorAll('div')].forEach((el) => {
			if (el.innerText === 'MUI X Missing license key') {
				el.remove();
			}
		});
	}, [ref]);
}
