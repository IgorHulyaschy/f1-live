import * as React from 'react';

export type Size = { width: number; height: number };

function measure(element: HTMLElement): Size {
	const rect = element.getBoundingClientRect();

	return { width: Math.round(rect.width), height: Math.round(rect.height) };
}

/** The box's size, measured before the first paint so a new picture is drawn at once. */
export function useElementSize(ref: React.RefObject<HTMLElement | null>): Size {
	const [size, setSize] = React.useState<Size>({ width: 0, height: 0 });

	React.useLayoutEffect(() => {
		const element = ref.current;

		if (!element) {
			return;
		}

		setSize(measure(element));

		const observer = new ResizeObserver(() => {
			const next = measure(element);

			setSize((current) =>
				current.width === next.width && current.height === next.height ? current : next
			);
		});

		observer.observe(element);

		return () => observer.disconnect();
	}, [ref]);

	return size;
}
