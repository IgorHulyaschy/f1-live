import * as React from 'react';
import { Link, useLocation } from 'react-router';
import { z } from 'zod';

import { BRAND } from '@/brand';
import { BottomNotice } from '@/components/bottom-notice';
import { Key, KeyGroup } from '@/components/console/keys';
import { createLocalStore } from '@/lib/local-store';

import {
	analyticsProvider,
	type AnalyticsState,
	type Consent,
	resolveAnalytics
} from './analytics';

const consentStore = createLocalStore<Consent | null>(
	'pitwall-consent',
	z.enum(['granted', 'denied']).nullable(),
	null
);

const provider = analyticsProvider(import.meta.env.VITE_ANALYTICS_PROVIDER);

export function useAnalytics(): AnalyticsState {
	const consent = consentStore.useValue();

	return React.useMemo(() => resolveAnalytics(provider, consent, import.meta.env.DEV), [consent]);
}

/** One page view per path; lap and driver changes rewrite the query and are not page views. */
export function usePageViews(): void {
	const { analytics } = useAnalytics();
	const { pathname } = useLocation();

	React.useEffect(() => {
		analytics.page(pathname);
	}, [analytics, pathname]);
}

/** Asks once, only when a provider is configured; both answers are one key away and equal. */
export function ConsentBanner() {
	const { ask } = useAnalytics();

	if (!ask || !provider) {
		return null;
	}

	return (
		<BottomNotice
			id="consent-banner"
			label="Privacy"
			actions={
				<>
					<Key onClick={() => consentStore.set('denied')}>Decline</Key>
					<Key onClick={() => consentStore.set('granted')}>Allow</Key>
				</>
			}
		>
			{BRAND.name} can count page views and the features you use, through {provider.name}, to learn
			which dashboards fans keep. No cookies, no advertising, no profile of you.{' '}
			<Link to="/legal/cookies" className="hover:text-foreground text-muted-foreground underline">
				Cookie notice
			</Link>
		</BottomNotice>
	);
}

const CONSENT_OPTIONS = [
	{ value: 'granted', label: 'Allow' },
	{ value: 'denied', label: 'Decline' }
] as const;

/** Changes an earlier answer; shown on the cookie notice. */
export function ConsentSettings() {
	const consent = consentStore.useValue();

	if (!provider) {
		return (
			<p className="text-muted-foreground text-sm" data-testid="consent-settings">
				This version of {BRAND.name} counts nothing, so there is nothing to allow.
			</p>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-3" data-testid="consent-settings">
			<span className="type-label">Usage counting</span>
			<KeyGroup<Consent>
				label="Usage counting"
				options={CONSENT_OPTIONS}
				value={consent ?? 'denied'}
				onChange={consentStore.set}
			/>
		</div>
	);
}
