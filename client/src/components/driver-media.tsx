import type { Driver } from '@f1-live/shared';
import * as React from 'react';

import { useDarkTheme } from '@/hooks/use-theme';
import { carImageUrl, driverPhotoUrls, teamLogoUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

function present(url: string | null): string[] {
	return url ? [url] : [];
}

/**
 * Pictures laid over their drawn fallback, tried in order. The fallback always renders, so a slow,
 * blocked or missing picture never leaves a hole or a broken-image icon; the picture fades in once loaded.
 */
function Overlay({ sources, className }: { sources: readonly string[]; className?: string }) {
	const key = sources.join(' ');
	const [state, setState] = React.useState({ key, index: 0, loaded: false });

	// New pictures (another driver) start over without carrying the last ones' state.
	const current = state.key === key ? state : { key, index: 0, loaded: false };
	const src = sources[current.index];

	if (!src) {
		return null;
	}

	return (
		<img
			key={src}
			src={src}
			alt=""
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			draggable={false}
			onLoad={() => setState({ key, index: current.index, loaded: true })}
			// A picture that fails hands over to the next source, and after the last to the drawing.
			onError={() => setState({ key, index: current.index + 1, loaded: false })}
			className={cn(
				'absolute inset-0 size-full transition-opacity duration-300',
				current.loaded ? 'opacity-100' : 'opacity-0',
				className
			)}
		/>
	);
}

/**
 * The driver's picture over their race number. Plates are neutral with a team-colour rule; only a
 * `tinted` plate (the driver you follow, or the one you are picking) takes the colour, so a wall
 * of twenty plates stays a timing screen, not a sticker sheet.
 */
export function DriverPortrait({
	driver,
	tinted = false,
	className
}: {
	driver: Driver;
	tinted?: boolean;
	className?: string;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				'plate relative block shrink-0 overflow-hidden',
				tinted ? 'bg-team/15' : 'bg-muted',
				className
			)}
			style={{ '--team': `#${driver.teamColour}` }}
		>
			<span
				className={cn(
					'plate-number absolute inset-x-0 bottom-0 font-mono font-black italic',
					tinted ? 'text-team' : 'text-foreground/30'
				)}
			>
				{driver.number}
			</span>
			<Overlay sources={driverPhotoUrls(driver, 240)} className="object-cover object-top" />
			<span className="bg-team absolute inset-x-0 bottom-0 h-0.5" />
		</span>
	);
}

/** The team's logo, or its name printed small. */
export function TeamLogo({ driver, className }: { driver: Driver; className?: string }) {
	const dark = useDarkTheme();

	return (
		<span className={cn('relative flex min-w-0 items-center', className)}>
			<span className="type-label truncate">{driver.team}</span>
			<Overlay
				sources={present(teamLogoUrl(driver, dark ? 'white' : 'black', 160))}
				className="bg-panel object-contain object-left"
			/>
		</span>
	);
}

/**
 * The car side on. The fallback is a generic single-seater outline in the team colour, drawn here:
 * it is not any team's car.
 */
export function CarSide({ driver, className }: { driver: Driver; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn('relative block aspect-4/1', className)}
			style={{ '--team': `#${driver.teamColour}` }}
		>
			<svg aria-hidden viewBox="0 0 400 100" className="absolute inset-0 size-full">
				<path
					className="fill-team"
					d="M4 80h56l6-6 70-10 18-12h26l8-10 18-6h22l6 6v12l78 6 10-20h50l2 6-6 2-4 32h-30l-6 4H86l-8 4H4z"
				/>
				<path className="fill-foreground/80" d="M160 52l14-8h18l-6 8z" />
				<circle className="fill-foreground" cx="96" cy="78" r="20" />
				<circle className="fill-foreground" cx="318" cy="76" r="22" />
				<circle className="fill-background" cx="96" cy="78" r="7" />
				<circle className="fill-background" cx="318" cy="76" r="8" />
			</svg>
			<Overlay sources={present(carImageUrl(driver, 640))} className="bg-panel object-contain" />
		</span>
	);
}
