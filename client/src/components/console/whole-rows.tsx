import * as React from 'react';

import { useElementSize } from '@/hooks/use-element-size';
import { cn } from '@/lib/utils';

/** The bottom edge of an element inside the scroller, from the scroller's top, ignoring transforms. */
function bottomWithin(element: HTMLElement, root: HTMLElement): number {
	let top = 0;
	let node: HTMLElement | null = element;

	while (node && node !== root) {
		top += node.offsetTop;
		node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
	}

	return top + element.offsetHeight;
}

/**
 * A list that fills the space it is given and shows whole rows only: the box ends at the last row
 * that fits, and the rest scrolls inside it. With room for every row it is as tall as they are.
 * `rows` selects the row elements inside it.
 */
export function WholeRows({
	rows,
	className,
	children
}: {
	rows: string;
	className?: string;
	children: React.ReactNode;
}) {
	const outer = React.useRef<HTMLDivElement>(null);
	const inner = React.useRef<HTMLDivElement>(null);
	const { height: room } = useElementSize(outer);
	const [height, setHeight] = React.useState<number | undefined>(undefined);
	const [start, setStart] = React.useState(0);

	const measure = React.useCallback(() => {
		const root = inner.current;

		if (!root || room === 0) {
			return;
		}

		const bottoms = [...root.querySelectorAll<HTMLElement>(rows)].map((row) =>
			bottomWithin(row, root)
		);

		const first = root.querySelector<HTMLElement>(rows);

		// Scroll snapping rests on the first row; without this the list sits scrolled by its own padding.
		setStart(first ? bottomWithin(first, root) - first.offsetHeight : 0);

		const fitting = bottoms.filter((bottom) => bottom <= room);
		const next = fitting.length === bottoms.length ? undefined : fitting.at(-1);

		setHeight((current) => (current === next ? current : next));
	}, [room, rows]);

	// After every render, and when the content resizes without one: rows change height with their text.
	React.useLayoutEffect(measure);

	React.useEffect(() => {
		const root = inner.current;

		if (!root) {
			return;
		}

		const observer = new ResizeObserver(measure);

		for (const child of root.children) {
			observer.observe(child);
		}

		return () => observer.disconnect();
	}, [measure]);

	return (
		<div ref={outer} className="min-h-0 flex-1">
			<div
				ref={inner}
				data-slot="whole-rows"
				style={{
					'--rows-height': height === undefined ? undefined : `${height}px`,
					'--rows-start': `${start}px`
				}}
				className={cn(
					'relative max-h-(--rows-height,100%) scroll-pt-(--rows-start) overflow-y-auto overscroll-contain',
					className
				)}
			>
				{children}
			</div>
		</div>
	);
}
