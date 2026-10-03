import { MoonIcon, SunIcon } from 'lucide-react';
import type * as React from 'react';
import { Link } from 'react-router';

import { BRAND } from '@/brand';
import { Key } from '@/components/console/keys';
import { SiteFooter } from '@/components/site-footer';
import { Wordmark } from '@/components/wordmark';
import { toggleTheme, useDarkTheme } from '@/hooks/use-theme';

/** The top bar of pages outside the race console: the wordmark home, and room for keys. */
function SiteHeader({ children }: { children?: React.ReactNode }) {
	return (
		<header className="bg-background/90 sticky top-0 z-40 mb-4 border-b backdrop-blur-sm">
			<div className="flex h-12 items-center gap-2 px-3 sm:px-4 md:px-6">
				<Link to="/" className="flex items-center" aria-label={`${BRAND.name} home`}>
					<Wordmark />
				</Link>
				{children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
			</div>
		</header>
	);
}

/** What shows until the race is in. index.html paints the same bar, wordmark bars only, before any script. */
export function LoadingState({ label = 'Loading the race' }: { label?: string }) {
	return (
		<div className="min-h-svh" aria-busy>
			<SiteHeader />
			<main className="flex flex-col gap-4 px-4 md:px-6">
				<output className="type-label">{label}</output>
			</main>
		</div>
	);
}

/** Legal pages and the error screen: the race console's frame without the race. */
export function SiteFrame({ children }: { children: React.ReactNode }) {
	const dark = useDarkTheme();

	return (
		<div className="flex min-h-svh flex-col">
			<SiteHeader>
				<Key
					onClick={toggleTheme}
					aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
				>
					{dark ? <SunIcon /> : <MoonIcon />}
				</Key>
			</SiteHeader>
			<main className="flex-1 px-4 pb-16 md:px-6">{children}</main>
			<SiteFooter />
		</div>
	);
}
