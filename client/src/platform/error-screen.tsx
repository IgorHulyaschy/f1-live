import { CopyIcon, RotateCwIcon } from 'lucide-react';
import * as React from 'react';
import { isRouteErrorResponse, Link, useLocation, useNavigate, useRouteError } from 'react-router';

import { BRAND } from '@/brand';
import { Key } from '@/components/console/keys';
import { SiteFrame } from '@/components/site-frame';
import { SESSION_PATH } from '@/features/dashboard/paths';

import { isStaleChunk } from './errors';
import { applyPageMeta } from './page-meta';

const LINK_KEY_CLASS =
	'type-label hover:text-foreground hover:border-rule-strong inline-flex h-9 items-center border border-b-2 px-2.5 transition-colors sm:h-7';

function Message({
	eyebrow,
	title,
	children,
	actions
}: {
	eyebrow: string;
	title: string;
	children: React.ReactNode;
	actions: React.ReactNode;
}) {
	return (
		<div className="flex max-w-2xl flex-col gap-4 py-8 md:py-16" data-testid="error-screen">
			<p className="type-label">{eyebrow}</p>
			<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">{title}</h1>
			<p className="text-muted-foreground text-sm">{children}</p>
			<div className="flex flex-wrap gap-2">{actions}</div>
		</div>
	);
}

function errorText(cause: unknown): string {
	return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
}

/** Every route's error boundary: a missing page, a version that moved on, or a crash. */
export function ErrorScreen() {
	const cause = useRouteError();
	const navigate = useNavigate();
	const location = useLocation();
	const [at] = React.useState(() => new Date().toISOString());
	const notFound = isRouteErrorResponse(cause) && cause.status === 404;
	const stale = isStaleChunk(cause);
	const title = notFound ? 'Page not found' : stale ? 'Update ready' : 'This screen stopped';

	// The root route's meta never runs while this screen stands in for it.
	React.useEffect(() => {
		applyPageMeta(
			{ title, description: BRAND.description, indexed: false },
			window.location.pathname
		);
	}, [title]);

	if (notFound) {
		return (
			<SiteFrame>
				<Message
					eyebrow="404"
					title={title}
					actions={
						<>
							<Link to={SESSION_PATH} className={LINK_KEY_CLASS}>
								Live timing
							</Link>
							<Link to="/library" className={LINK_KEY_CLASS}>
								Library
							</Link>
						</>
					}
				>
					Nothing lives at this address. Dashboards you made open from the library, in the browser
					that made them.
				</Message>
			</SiteFrame>
		);
	}

	const reload = (
		<Key onClick={() => window.location.reload()}>
			<RotateCwIcon />
			Reload
		</Key>
	);

	if (stale) {
		return (
			<SiteFrame>
				<Message eyebrow="New version" title={title} actions={reload}>
					{BRAND.name} was updated while this page was open. Reload to switch to the new version;
					your dashboards and settings stay as they are.
				</Message>
			</SiteFrame>
		);
	}

	const details = `${errorText(cause)}\nPage: ${location.pathname}${location.search}\nTime: ${at}`;

	return (
		<SiteFrame>
			<Message
				eyebrow="Something broke"
				title={title}
				actions={
					<>
						<Key pressed onClick={() => void navigate(location, { replace: true })}>
							Try again
						</Key>
						{reload}
						<Link to={SESSION_PATH} className={LINK_KEY_CLASS}>
							Live timing
						</Link>
					</>
				}
			>
				Your dashboards and settings are safe in this browser. Try again, or reload the page. If it
				keeps happening, send the details below to{' '}
				<a
					href={`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent('Error report')}&body=${encodeURIComponent(details)}`}
					className="text-foreground underline"
				>
					{BRAND.supportEmail}
				</a>
				.
			</Message>
			<section aria-labelledby="error-details" className="flex max-w-2xl flex-col gap-2">
				<div className="border-rule-strong flex items-center gap-3 border-t-2 pt-2">
					<h2 id="error-details" className="type-label">
						Details
					</h2>
					<Key
						className="ml-auto"
						aria-label="Copy error details"
						onClick={() => void navigator.clipboard.writeText(details).catch(() => undefined)}
					>
						<CopyIcon />
						Copy
					</Key>
				</div>
				<pre className="text-muted-foreground overflow-x-auto font-mono text-xs whitespace-pre-wrap">
					{details}
				</pre>
			</section>
		</SiteFrame>
	);
}
