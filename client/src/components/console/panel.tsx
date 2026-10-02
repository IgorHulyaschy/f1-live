import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A region of the console. Regions sit flush in a grid and are divided by hairlines rather than
 * floating as separate cards, so dense data reads as one surface.
 */
export function Panel({ className, ...props }: React.ComponentProps<'section'>) {
	return <section className={cn('bg-panel flex min-w-0 flex-col', className)} {...props} />;
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
			className={cn(
				'flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2',
				className
			)}
		>
			<h2 className="font-display text-sm font-semibold tracking-wider uppercase">{title}</h2>
			{meta ? <span className="text-muted-foreground font-mono text-xs">{meta}</span> : null}
			{children ? (
				<div className="ml-auto flex max-w-full items-center gap-2 overflow-x-auto">{children}</div>
			) : null}
		</header>
	);
}

/** Small uppercase label above a reading. */
export function Eyebrow({ className, ...props }: React.ComponentProps<'span'>) {
	return (
		<span
			className={cn(
				'text-muted-foreground font-display text-xs font-medium tracking-wider uppercase',
				className
			)}
			{...props}
		/>
	);
}

export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
	return (
		<kbd
			className={cn(
				'bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-xs',
				className
			)}
			{...props}
		/>
	);
}
