import * as React from 'react';

import { useDarkTheme } from '@/hooks/use-theme';
import {
	carPicture,
	driverPictures,
	type Face,
	type Picture,
	teamLogoPicture,
	type TeamSubject
} from '@/lib/media';
import { cn } from '@/lib/utils';

/**
 * Every portrait, logo and car box in the app comes from these scales: the class fixes the box so
 * nothing shifts while a picture loads, and `px` is the width the file is cut to (and doubled for
 * dense screens). A portrait without a size takes its box from the caller.
 */
const PORTRAIT_SCALE = {
	xs: { px: 24, h: 24, box: 'size-6' },
	sm: { px: 32, h: 32, box: 'size-8' },
	md: { px: 48, h: 48, box: 'size-12' },
	lg: { px: 80, h: 96, box: 'h-24 w-20' },
	xl: { px: 144, h: 176, box: 'h-36 w-28 @md:h-44 @md:w-36' }
} as const;

export type PortraitSize = keyof typeof PORTRAIT_SCALE;

const LOGO_SCALE = {
	sm: { px: 64, h: 16, box: 'h-4 w-16' },
	md: { px: 112, h: 20, box: 'h-5 w-28' }
} as const;

export type LogoSize = keyof typeof LOGO_SCALE;

const CAR_SCALE = {
	sm: { px: 96, h: 24, box: 'w-24' },
	fill: { px: 640, h: 160, box: '' }
} as const;

export type CarSize = keyof typeof CAR_SCALE;

function present(picture: Picture | null): Picture[] {
	return picture ? [picture] : [];
}

/**
 * Pictures laid over their drawn fallback, tried in order. The fallback always renders, so a slow,
 * blocked or missing picture never leaves a hole or a broken-image icon; the picture fades in once loaded.
 */
function Overlay({
	pictures,
	alt = '',
	width,
	height,
	className
}: {
	pictures: readonly Picture[];
	/** The box in pixels, for the browser to reserve before the file arrives. */
	width: number;
	height: number;
	/** The driver's name for a portrait; empty where the name is written next to the picture. */
	alt?: string;
	className?: string;
}) {
	const key = pictures.map(({ src }) => src).join(' ');
	const [state, setState] = React.useState({ key, index: 0, loaded: false });

	// New pictures (another driver) start over without carrying the last ones' state.
	const current = state.key === key ? state : { key, index: 0, loaded: false };
	const picture = pictures[current.index];

	if (!picture) {
		return null;
	}

	return (
		<img
			key={picture.src}
			src={picture.src}
			srcSet={picture.srcSet}
			alt={alt}
			width={width}
			height={height}
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			draggable={false}
			onLoad={() => setState({ key, index: current.index, loaded: true })}
			// A picture that fails hands over to the next source, and after the last to the drawing.
			onError={() => setState({ key, index: current.index + 1, loaded: false })}
			className={cn(
				'absolute inset-0 size-full transition-opacity duration-300 motion-reduce:transition-none',
				current.loaded ? 'opacity-100' : 'opacity-0',
				className
			)}
		/>
	);
}

/**
 * The driver's picture over their race number. Plates are neutral with a team-colour rule; only a
 * `tinted` plate (the driver you follow, or the one you are picking) takes the colour, so a wall
 * of twenty plates stays a timing screen, not a sticker sheet. The picture's alt text is the
 * driver's name.
 */
export function DriverPortrait({
	driver,
	size,
	tinted = false,
	mirrored = false,
	className
}: {
	driver: Face;
	size?: PortraitSize;
	tinted?: boolean;
	/** Faces left instead of right, for the right-hand side of a pair. */
	mirrored?: boolean;
	className?: string;
}) {
	const scale = size ? PORTRAIT_SCALE[size] : null;

	return (
		<span
			className={cn(
				'plate relative block shrink-0 overflow-hidden',
				tinted ? 'bg-team/15' : 'bg-muted',
				scale?.box,
				className
			)}
			style={{ '--team': `#${driver.teamColour}` }}
		>
			{/* Generated content: the number is paint, so contrast audits skip it. */}
			<span
				aria-hidden
				data-number={driver.number}
				className={cn(
					'plate-number absolute inset-x-0 bottom-0 font-mono font-black italic after:content-[attr(data-number)]',
					tinted ? 'text-team' : 'text-foreground/30'
				)}
			/>
			<Overlay
				pictures={driverPictures(driver, scale?.px ?? 240)}
				alt={`${driver.firstName} ${driver.lastName}`}
				width={scale?.px ?? 240}
				height={scale?.h ?? 240}
				className={cn('object-cover object-top', mirrored && '-scale-x-100')}
			/>
			<span aria-hidden className="bg-team absolute inset-x-0 bottom-0 h-0.5" />
		</span>
	);
}

/** The team's logo, or its name printed small. The name is the label; the logo is decoration. */
export function TeamLogo({
	subject,
	size = 'md',
	showName = true,
	className
}: {
	subject: TeamSubject;
	size?: LogoSize;
	/** False where the team's name is written next to the logo. */
	showName?: boolean;
	className?: string;
}) {
	const dark = useDarkTheme();
	const scale = LOGO_SCALE[size];

	return (
		<span className={cn('relative flex min-w-0 items-center', scale.box, className)}>
			{showName ? <span className="type-label truncate">{subject.team}</span> : null}
			<Overlay
				pictures={present(teamLogoPicture(subject, dark ? 'white' : 'black', scale.px))}
				width={scale.px}
				height={scale.h}
				className="bg-panel object-contain object-left"
			/>
		</span>
	);
}

/**
 * The car side on. The fallback is a generic single-seater outline in the team colour, drawn here:
 * it is not any team's car.
 */
export function CarSide({
	subject,
	size = 'fill',
	className
}: {
	subject: TeamSubject;
	size?: CarSize;
	className?: string;
}) {
	const scale = CAR_SCALE[size];

	return (
		<span
			aria-hidden
			className={cn('relative block aspect-4/1 shrink-0', scale.box, className)}
			style={{ '--team': `#${subject.teamColour}` }}
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
			<Overlay
				pictures={present(carPicture(subject, scale.px))}
				width={scale.px}
				height={scale.h}
				className="bg-panel object-contain"
			/>
		</span>
	);
}
