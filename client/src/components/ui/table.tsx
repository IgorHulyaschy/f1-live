import type * as React from 'react';

import { cn } from '@/lib/utils';

/** `inset` pads the first and last column to line up with card content. */
function Table({
	className,
	inset = false,
	...props
}: React.ComponentProps<'table'> & { inset?: boolean }) {
	return (
		<div data-slot="table-container" className="relative w-full overflow-x-auto">
			<table
				data-slot="table"
				className={cn(
					'w-full caption-bottom text-sm',
					inset && '[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4',
					className
				)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
	return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
	return (
		<tbody
			data-slot="table-body"
			className={cn('[&_tr:last-child]:border-0', className)}
			{...props}
		/>
	);
}

/** `interactive` rows are clickable; `muted` rows de-emphasise inactive entries. */
function TableRow({
	className,
	interactive = false,
	muted = false,
	...props
}: React.ComponentProps<'tr'> & { interactive?: boolean; muted?: boolean }) {
	return (
		<tr
			data-slot="table-row"
			className={cn(
				'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
				interactive && 'cursor-pointer',
				muted && 'text-muted-foreground',
				className
			)}
			{...props}
		/>
	);
}

/** `numeric` right-aligns the column for figures. */
function TableHead({
	className,
	numeric = false,
	...props
}: React.ComponentProps<'th'> & { numeric?: boolean }) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				'text-muted-foreground h-10 px-2 text-left align-middle text-xs font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0',
				numeric && 'text-right',
				className
			)}
			{...props}
		/>
	);
}

/** `numeric` sets figures right-aligned in tabular monospace so columns line up. */
function TableCell({
	className,
	numeric = false,
	...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
				numeric && 'text-right font-mono tabular-nums',
				className
			)}
			{...props}
		/>
	);
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
