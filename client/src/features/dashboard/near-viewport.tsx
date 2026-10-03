import * as React from 'react';

import { Panel, PanelHeader } from '@/components/console/panel';
import { cn } from '@/lib/utils';

/**
 * A heavy tile renders once it comes on screen, takes keyboard focus, or the page is printed, and
 * stays rendered after. Until then it is its ruled header over an empty body
 * of the tile's size, so the first screen of a long dashboard does not pay for tiles far below.
 */
export function NearViewport({
	title,
	fill,
	children
}: {
	title: string;
	/** The tile has a fixed size on the grid; stacked on a phone it takes a typical tile's height. */
	fill: boolean;
	children: React.ReactNode;
}) {
	const placeholder = React.useRef<HTMLElement>(null);
	const [near, setNear] = React.useState(false);

	// Measured before the first paint: a tile already on screen renders at once, never as a swap.
	React.useLayoutEffect(() => {
		const element = placeholder.current;

		if (near || !element) {
			return;
		}

		const show = () => setNear(true);

		if (element.getBoundingClientRect().top < window.innerHeight) {
			show();

			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					show();
				}
			},
			// No margin: while lazy tiles above are still loading, everything below sits higher than
			// it will, and a margin would pull far tiles in.
			{ rootMargin: '0px' }
		);

		observer.observe(element);
		window.addEventListener('beforeprint', show);

		return () => {
			observer.disconnect();
			window.removeEventListener('beforeprint', show);
		};
	}, [near]);

	if (near) {
		return children;
	}

	return (
		<Panel
			ref={placeholder}
			aria-busy
			aria-label={title}
			// Reachable by keyboard so focus can bring it in, even where nothing scrolls it into view.
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
			tabIndex={0}
			onFocus={() => setNear(true)}
			className={cn(fill ? 'h-full' : 'h-80')}
		>
			<PanelHeader title={title} />
		</Panel>
	);
}
