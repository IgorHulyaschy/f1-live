import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * What a dashboard puts at the end of a tile's header: its overflow menu. Every tile has the one
 * header pattern, title left, modes right, the rest in the menu; a panel inside a panel leaves it
 * to the outer one.
 */
export const PanelMenuContext = React.createContext<React.ReactNode>(null);

const PanelDepthContext = React.createContext(0);

/**
 * A region of the timing screen. Regions are not cards: they sit flush, open with a heavy rule
 * and a printed label, and are divided from each other by hairlines.
 *
 * A panel is a size container: what it shows depends on the width of its tile, not of the
 * screen, so it reads the same in a narrow side tile on a 4K monitor as on a phone.
 */
export function Panel({ className, children, ...props }: React.ComponentProps<'section'>) {
	const depth = React.useContext(PanelDepthContext);

	return (
		<section className={cn('bg-panel @container flex min-w-0 flex-col', className)} {...props}>
			<PanelDepthContext value={depth + 1}>{children}</PanelDepthContext>
		</section>
	);
}

export function PanelHeader({
	title,
	meta,
	headline,
	children,
	className
}: {
	title: React.ReactNode;
	meta?: React.ReactNode;
	/** One line in words that says what the tile shows right now, before its numbers. */
	headline?: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
}) {
	const menu = React.useContext(PanelMenuContext);
	const depth = React.useContext(PanelDepthContext);
	const end = depth <= 1 ? menu : null;

	return (
		<header
			data-slot="panel-header"
			className={cn(
				'border-rule-strong bg-panel flex min-h-10 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-1.5',
				className
			)}
		>
			<h2 className="type-wide text-xs font-bold">{title}</h2>
			{headline ? (
				<p
					data-testid="headline"
					className="line-clamp-2 min-w-48 flex-1 text-sm leading-tight font-medium"
				>
					{headline}
				</p>
			) : null}
			{meta ? <span className="type-label">{meta}</span> : null}
			{children || end ? (
				// The menu wraps with the controls, never onto a row of its own.
				<div className="ml-auto flex max-w-full min-w-0 items-center gap-2">
					{children ? (
						<div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
					) : null}
					{end ? <div className="flex shrink-0">{end}</div> : null}
				</div>
			) : null}
		</header>
	);
}

/** Instrument-panel micro-label. */
export function Eyebrow({ className, ...props }: React.ComponentProps<'span'>) {
	return <span className={cn('type-label', className)} {...props} />;
}

/** A labelled reading: label printed above, value below. Used instead of dot-separated text. */
export function Field({
	label,
	children,
	className
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('flex min-w-0 flex-col', className)}>
			<span className="type-label">{label}</span>
			<span className="truncate text-sm font-medium">{children}</span>
		</div>
	);
}

export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
	return (
		<kbd
			className={cn(
				'text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center border border-b-2 px-1 font-mono text-xs',
				className
			)}
			{...props}
		/>
	);
}
