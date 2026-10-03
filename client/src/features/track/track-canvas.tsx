import { useReducedMotion } from 'motion/react';
import * as React from 'react';

import { useRace } from '@/data/race-context';
import { useDarkTheme } from '@/hooks/use-theme';
import { useRemPixels } from '@/hooks/use-scale';
import { cn } from '@/lib/utils';

import { type MapTheme, readTheme } from './track-draw';

export type DrawFrame = {
	ctx: CanvasRenderingContext2D;
	perf: number;
	/** In CSS pixels. */
	width: number;
	height: number;
	rem: number;
	theme: MapTheme;
	reducedMotion: boolean;
	/** Off screen no one sees a camera ease, so it lands at once. */
	onScreen: boolean;
	/** Milliseconds since the frame before, for easing a camera. */
	elapsed: number;
};

/** With reduced motion a moving map is redrawn this often instead of every frame. */
const REDUCED_MOTION_MS = 1000;

/** Frames drawn and the main-thread time spent drawing them, for the performance report. */
type MapStats = { frames: number; drawMs: number };

declare global {
	interface Window {
		pitwallMapStats?: MapStats;
	}
}

type Size = { width: number; height: number };

function measure(element: HTMLElement): Size {
	const rect = element.getBoundingClientRect();

	return { width: Math.round(rect.width), height: Math.round(rect.height) };
}

/** The box's size, measured before the first paint so a new map is drawn at once. */
function useSize(ref: React.RefObject<HTMLElement | null>): Size {
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

/** Whether the element is on screen and the page is in front: a hidden map draws nothing. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>): boolean {
	const [inView, setInView] = React.useState(true);
	const [pageVisible, setPageVisible] = React.useState(() => document.visibilityState !== 'hidden');

	React.useEffect(() => {
		const element = ref.current;

		if (!element) {
			return;
		}

		const observer = new IntersectionObserver(([entry]) =>
			setInView(entry?.isIntersecting ?? true)
		);

		const onVisibility = () => setPageVisible(document.visibilityState !== 'hidden');

		observer.observe(element);
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [ref]);

	return inView && pageVisible;
}

/**
 * A crisp canvas the size of its box, drawn by `draw`: every frame while `moving`, otherwise
 * whenever its inputs change or `subscribe` reports news. Colours follow the theme.
 */
export function TrackCanvas({
	draw,
	moving,
	subscribe,
	label,
	onPick,
	className
}: {
	/** Draws a frame; true asks for the next one even while still, as when a camera is easing. */
	draw: (frame: DrawFrame) => boolean;
	moving: boolean;
	subscribe?: (listener: () => void) => () => void;
	label: string;
	/** A click or tap on the map, in CSS pixels from its top left. */
	onPick?: (x: number, y: number) => void;
	className?: string;
}) {
	const box = React.useRef<HTMLElement>(null);
	const canvas = React.useRef<HTMLCanvasElement>(null);
	const { width, height } = useSize(box);
	const onScreen = useOnScreen(box);
	const rem = useRemPixels();
	const dark = useDarkTheme();
	const { followedDriver } = useRace();
	const reducedMotion = useReducedMotion() ?? false;
	const [fontsReady, setFontsReady] = React.useState(false);

	// Labels need the mono face; a map drawn before it loads is drawn again once it has.
	React.useEffect(() => {
		let cancelled = false;

		async function waitForFonts() {
			await document.fonts.ready;

			if (!cancelled) {
				setFontsReady(true);
			}
		}

		void waitForFonts();

		return () => {
			cancelled = true;
		};
	}, []);

	// Colours live in CSS: they are read again when the theme changes, or the followed driver
	// re-tints `--focus`.
	const themeRef = React.useRef<{ key: string; theme: MapTheme } | null>(null);
	const themeKey = `${dark}/${followedDriver}`;

	const drawRef = React.useRef(draw);
	const lastPerf = React.useRef(0);
	const wake = React.useRef(() => {});

	const paint = React.useCallback(
		(perf: number) => {
			const element = canvas.current;
			const ctx = element?.getContext('2d');

			if (!element || !ctx || !box.current || width === 0 || height === 0) {
				return false;
			}

			if (themeRef.current?.key !== themeKey) {
				themeRef.current = { key: themeKey, theme: readTheme(box.current) };
			}

			const { theme } = themeRef.current;

			const started = performance.now();
			const ratio = window.devicePixelRatio || 1;
			const pixelWidth = Math.round(width * ratio);
			const pixelHeight = Math.round(height * ratio);

			if (element.width !== pixelWidth || element.height !== pixelHeight) {
				element.width = pixelWidth;
				element.height = pixelHeight;
			}

			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
			ctx.clearRect(0, 0, width, height);

			const elapsed =
				lastPerf.current === 0 ? 0 : Math.min(250, Math.max(0, perf - lastPerf.current));

			lastPerf.current = perf;

			const again = drawRef.current({
				ctx,
				perf,
				width,
				height,
				rem,
				theme,
				reducedMotion,
				onScreen,
				elapsed
			});

			const stats = (window.pitwallMapStats ??= { frames: 0, drawMs: 0 });

			stats.frames++;
			stats.drawMs += performance.now() - started;

			return again;
		},
		[themeKey, width, height, rem, reducedMotion, onScreen]
	);

	// Every render paints as part of its commit, on screen or not, so a map is never seen blank or
	// stale when it scrolls into view or the page is captured whole.
	React.useLayoutEffect(() => {
		drawRef.current = draw;

		// A camera that starts easing in a paused map asks for the frames that land it.
		if (paint(performance.now()) && onScreen) {
			wake.current();
		}
	});

	// On screen and moving: a frame per display refresh, or once a second with reduced motion.
	// Otherwise a frame whenever something changes.
	React.useEffect(() => {
		const animate = onScreen && moving;

		if (animate && reducedMotion) {
			const timer = window.setInterval(() => paint(performance.now()), REDUCED_MOTION_MS);

			wake.current = () => {};

			return () => window.clearInterval(timer);
		}

		let frame = 0;

		const loop = (perf: number) => {
			if ((paint(perf) && onScreen) || animate) {
				frame = requestAnimationFrame(loop);
			}
		};

		// On screen, one frame more lands a camera whose easing the last effect's end cut short.
		if (animate || onScreen) {
			frame = requestAnimationFrame(loop);
		}

		wake.current = () => {
			if (!animate) {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(loop);
			}
		};

		const stop = subscribe?.(() => wake.current());

		return () => {
			cancelAnimationFrame(frame);
			stop?.();
			wake.current = () => {};
		};
	}, [onScreen, moving, reducedMotion, paint, subscribe]);

	return (
		<figure
			ref={box}
			className={cn('relative min-h-0 min-w-0 flex-1 overflow-hidden', className)}
			data-fonts={fontsReady || undefined}
		>
			<figcaption className="sr-only">{label}</figcaption>
			<canvas
				ref={canvas}
				aria-hidden
				className={cn('absolute inset-0 size-full', onPick && 'cursor-pointer')}
				onClick={
					onPick
						? (event) => {
								const rect = event.currentTarget.getBoundingClientRect();

								onPick(event.clientX - rect.left, event.clientY - rect.top);
							}
						: undefined
				}
			/>
		</figure>
	);
}
