import type * as React from 'react';
import { Link } from 'react-router';

import { BRAND } from '@/brand';
import { cn } from '@/lib/utils';

const LINK_CLASS = 'hover:text-foreground inline-flex min-h-6 items-center transition-colors';

/**
 * The line every page keeps (plan 4): unofficial, not associated with the Formula 1 companies.
 * Below it, the legal pages and support; `children` adds keys and notes for the page it closes.
 */
export function SiteFooter({
	note,
	className,
	children
}: {
	note?: string;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<footer
			className={cn(
				'text-muted-foreground flex flex-col gap-3 px-4 pb-8 text-xs md:px-6',
				className
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2">
				<p className="max-w-3xl">
					Unofficial. Not associated in any way with the Formula 1 companies.
					{note ? ` ${note}` : null}
				</p>
				{children}
			</div>
			<nav aria-label="Site" className="type-label flex flex-wrap gap-x-5 gap-y-1">
				<Link to="/legal/terms" className={LINK_CLASS}>
					Terms
				</Link>
				<Link to="/legal/privacy" className={LINK_CLASS}>
					Privacy
				</Link>
				<Link to="/legal/cookies" className={LINK_CLASS}>
					Cookies
				</Link>
				<a href={`mailto:${BRAND.supportEmail}`} className={LINK_CLASS}>
					Support
				</a>
				{BRAND.social.map((link) => (
					<a
						key={link.url}
						href={link.url}
						rel="me noopener"
						target="_blank"
						className={LINK_CLASS}
					>
						{link.label}
					</a>
				))}
			</nav>
		</footer>
	);
}
