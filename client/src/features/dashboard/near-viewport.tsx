import * as React from 'react';
import { flushSync } from 'react-dom';

import { Panel, PanelHeader } from '@/components/console/panel';
import { cn } from '@/lib/utils';

/**
 * A heavy tile renders once it comes on screen, takes keyboard focus, or the page is printed, and
 * stays rendered after. Until then it is its ruled header over an empty body of the tile's size,
 * so the first screen of a long dashboard does not pay for tiles far below.
 *
 * The wrapper is the same element before and after, so focus that brought the tile in stays on it
 * and the next Tab goes into the tile.
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
	const wrapper = React.useRef<HTMLDivElement>(null);
	const [near, setNear] = React.useState(false);

	// Measured before the first paint: a tile already on screen renders at once, never as a swap.
	React.useLayoutEffect(() => {
		const element = wrapper.current;

		if (near || !element) {
			return;
		}

		const show = () => setNear(true);

		if (element.getBoundingClientRect().top < window.innerHeight) {
			show();

			return;
		}

		// No margin: while lazy tiles above are still loading, everything below sits higher than it
		// will, and a margin would pull far tiles in.
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				show();
			}
		});

		// The print layout is taken right after this event, so the tile must be in the page by then.
		const print = () => flushSync(show);

		observer.observe(element);
		window.addEventListener('beforeprint', print);

		return () => {
			observer.disconnect();
			window.removeEventListener('beforeprint', print);
		};
	}, [near]);

	// A named group that is a tab stop until it renders, so focus can bring it in where nothing
	// scrolls it into view; no native element is a focusable, non-interactive group.
	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
		<div
			ref={wrapper}
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
			role="group"
			aria-label={title}
			aria-busy={!near}
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
			tabIndex={near ? -1 : 0}
			onFocus={() => setNear(true)}
			className={cn(
				'focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:outline-none focus-visible:ring-inset',
				fill && 'h-full'
			)}
		>
			{near ? (
				children
			) : (
				<Panel className={cn(fill ? 'h-full' : 'h-80')}>
					<PanelHeader title={title} />
				</Panel>
			)}
		</div>
	);
}
