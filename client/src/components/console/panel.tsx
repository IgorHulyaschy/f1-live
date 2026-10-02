import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A region of the timing screen. Regions are not cards: they sit flush, open with a heavy rule
 * and a printed label, and are divided from each other by hairlines.
 *
 * A panel is a size container: what it shows depends on the width of its tile, not of the
 * screen, so it reads the same in a narrow side tile on a 4K monitor as on a phone.
 */
export function Panel({ className, ...props }: React.ComponentProps<'section'>) {
	return (
		<section className={cn('bg-panel @container flex min-w-0 flex-col', className)} {...props} />
	);
}

export function PanelHeader({
	title,
	meta,
	children,
	className
}: {
	title: React.ReactNode;
	meta?: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
}) {
	return (
		<header
			data-slot="panel-header"
			className={cn(
				'border-rule-strong bg-panel flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-b px-4 py-1.5',
				className
			)}
		>
			<h2 className="type-wide text-xs font-bold">{title}</h2>
			{meta ? <span className="type-label">{meta}</span> : null}
			{children ? (
				<div className="ml-auto flex max-w-full items-center gap-2 overflow-x-auto">{children}</div>
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
