import type * as React from 'react';

import { Key } from '@/components/console/keys';
import { cn } from '@/lib/utils';

export type DataColumn = {
	key: string;
	label: React.ReactNode;
	/** Numbers line up on the right. */
	numeric?: boolean;
};

/**
 * The numbers behind a chart, as a table: what a screen reader, a keyboard or a careful reader
 * gets instead of the drawing. The header stays put while the rows scroll.
 */
export function DataTable({
	caption,
	columns,
	rows,
	className
}: {
	caption: string;
	columns: readonly DataColumn[];
	rows: readonly ({ id: string } & Record<string, React.ReactNode>)[];
	className?: string;
}) {
	return (
		<div className={cn('max-h-120 min-h-0 overflow-auto', className)} data-testid="data-table">
			<table className="w-full text-sm">
				<caption className="sr-only">{caption}</caption>
				<thead className="bg-panel sticky top-0">
					<tr className="border-b">
						{columns.map((column) => (
							<th
								key={column.key}
								scope="col"
								className={cn(
									'type-label px-2 py-1.5 font-normal whitespace-nowrap first:pl-0',
									column.numeric ? 'text-right' : 'text-left'
								)}
							>
								{column.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.id} className="h-8 border-b last:border-b-0">
							{columns.map((column) => (
								<td
									key={column.key}
									className={cn(
										'px-2 whitespace-nowrap first:pl-0',
										column.numeric && 'text-right font-mono'
									)}
								>
									{row[column.key] ?? '–'}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** The key that swaps a chart for its table and back. */
export function TableKey({
	table,
	onTableChange
}: {
	table: boolean;
	onTableChange: (table: boolean) => void;
}) {
	return (
		<Key pressed={table} aria-pressed={table} onClick={() => onTableChange(!table)}>
			Table
		</Key>
	);
}
