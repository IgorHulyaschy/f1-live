import { NavLink } from 'react-router';

import { Field } from '@/components/console/panel';
import { cn } from '@/lib/utils';
import { ConsentSettings } from '@/platform/consent';
import type { RouteHandle } from '@/platform/page-meta';

import { type LegalDocument, LEGAL_DOCUMENTS, type LegalSection, type LegalSlug } from './content';

/** The same names the footer links use. */
const NAV_LABELS: Record<LegalSlug, string> = {
	terms: 'Terms',
	privacy: 'Privacy',
	cookies: 'Cookies'
};

const UPDATED_FORMAT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

/** "Usage counts" → "usage-counts", so a section can be linked to. */
function anchor(heading: string): string {
	return heading.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}

function Section({ section }: { section: LegalSection }) {
	const id = anchor(section.heading);

	return (
		<section
			id={id}
			aria-labelledby={`${id}-heading`}
			className="border-rule-strong flex scroll-mt-16 flex-col gap-3 border-t-2 pt-3"
		>
			<h2 id={`${id}-heading`} className="type-wide text-xs font-bold">
				{section.heading}
			</h2>
			{section.paragraphs.map((paragraph) => (
				<p key={paragraph} className="text-sm leading-6">
					{paragraph}
				</p>
			))}
			{section.list ? (
				<ul className="flex flex-col border-l text-sm leading-6">
					{section.list.map((item) => (
						<li key={item} className="pl-3">
							{item}
						</li>
					))}
				</ul>
			) : null}
			{section.control === 'consent' ? <ConsentSettings /> : null}
		</section>
	);
}

function legalDocument(slug: LegalSlug): LegalDocument {
	const legal = LEGAL_DOCUMENTS.find((entry) => entry.slug === slug);

	if (!legal) {
		throw new Error(`content.ts has no legal document "${slug}"`);
	}

	return legal;
}

/** One legal document from content.ts, with the other two a key away. */
function LegalPage({ slug }: { slug: LegalSlug }) {
	const legal = legalDocument(slug);

	return (
		<article className="flex max-w-3xl flex-col gap-8 py-4" data-testid={`legal-${slug}`}>
			<nav aria-label="Legal" className="flex">
				{LEGAL_DOCUMENTS.map((entry, index) => (
					<NavLink
						key={entry.slug}
						to={`/legal/${entry.slug}`}
						className={({ isActive }) =>
							cn(
								'type-label inline-flex h-9 items-center border border-b-2 px-2.5 transition-colors sm:h-7',
								index > 0 && '-ml-px',
								isActive
									? 'border-foreground bg-foreground text-background'
									: 'hover:text-foreground hover:border-rule-strong'
							)
						}
					>
						{NAV_LABELS[entry.slug]}
					</NavLink>
				))}
			</nav>
			<header className="flex flex-col gap-4">
				<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">
					{legal.title}
				</h1>
				<p className="text-muted-foreground text-sm leading-6">{legal.summary}</p>
				<div className="flex divide-x">
					<Field label="Last updated" className="pr-4">
						<time dateTime={legal.updated}>{UPDATED_FORMAT.format(new Date(legal.updated))}</time>
					</Field>
					{legal.draft ? (
						<Field label="Status" className="pl-4">
							Draft, pending legal review
						</Field>
					) : null}
				</div>
			</header>
			{legal.sections.map((section) => (
				<Section key={section.heading} section={section} />
			))}
		</article>
	);
}

/** The lazy route for one legal page: its component, and its title and summary for the tab. */
export function legalRoute(slug: LegalSlug) {
	const { title, summary } = legalDocument(slug);
	const handle: RouteHandle = { meta: () => ({ title, description: summary, indexed: true }) };

	return { Component: () => <LegalPage slug={slug} />, handle };
}
