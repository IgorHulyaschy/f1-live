import type * as React from 'react';

/**
 * A question pinned to the bottom edge, like the pit board: a heavy rule, a printed label, one
 * line of text and its keys. It never blocks the page, so it is a region, not a dialog. It is
 * sticky rather than fixed, so at the end of the page it sits below the footer, not over it.
 */
export function BottomNotice({
	id,
	label,
	actions,
	children
}: {
	id: string;
	label: string;
	actions: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section
			aria-labelledby={`${id}-label`}
			data-testid={id}
			className="bg-background border-rule-strong sticky bottom-0 z-50 flex flex-wrap items-center gap-x-8 gap-y-3 border-t-2 px-4 py-3 md:px-6"
		>
			<div className="flex max-w-3xl min-w-0 flex-col gap-1">
				<h2 id={`${id}-label`} className="type-label">
					{label}
				</h2>
				<p className="text-sm">{children}</p>
			</div>
			<div className="ml-auto flex gap-2">{actions}</div>
		</section>
	);
}
