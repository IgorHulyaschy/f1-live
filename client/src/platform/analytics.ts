/**
 * Product analytics behind one interface, so the provider is a configuration choice. Plan 2 asks
 * for a counter of events, not people (Plausible or a self-hosted Umami). None is chosen yet, so
 * nothing leaves the browser: development builds print the calls and production builds drop them.
 */

export type EventValue = string | number | boolean;

export type Analytics = {
	/** A page was shown. Only the path is sent: queries carry laps, drivers and whole dashboards. */
	page: (path: string) => void;
	event: (name: string, properties?: Readonly<Record<string, EventValue>>) => void;
};

export type AnalyticsProvider = {
	/** Named in the consent banner. */
	name: string;
	/** Starts the provider; called only once the viewer has allowed it. */
	start: () => Analytics;
};

export type Consent = 'granted' | 'denied';

export const silentAnalytics: Analytics = {
	page: () => undefined,
	event: () => undefined
};

export const consoleAnalytics: Analytics = {
	page: (path) => {
		// oxlint-disable-next-line no-console -- development builds show what a provider would get.
		console.info('[analytics] page', path);
	},
	event: (name, properties) => {
		// oxlint-disable-next-line no-console -- development builds show what a provider would get.
		console.info('[analytics] event', name, properties ?? {});
	}
};

/**
 * Providers this build can start, by the `VITE_ANALYTICS_PROVIDER` value. Owner item: add the
 * chosen counter here as a first-party module; no third-party script tags. `console` exists to try
 * the consent flow locally.
 */
const PROVIDERS: ReadonlyMap<string, AnalyticsProvider> = new Map([
	['console', { name: 'the browser console', start: () => consoleAnalytics }]
]);

/** The configured provider, if any; however many components ask, it starts once. */
export function analyticsProvider(name: string | undefined): AnalyticsProvider | null {
	const provider = name ? PROVIDERS.get(name) : undefined;

	if (!provider) {
		return null;
	}

	let started: Analytics | null = null;

	return { name: provider.name, start: () => (started ??= provider.start()) };
}

export type AnalyticsState = {
	/** The consent banner is shown: a provider is configured and the viewer has not chosen yet. */
	ask: boolean;
	analytics: Analytics;
};

export function resolveAnalytics(
	provider: AnalyticsProvider | null,
	consent: Consent | null,
	development: boolean
): AnalyticsState {
	if (!provider) {
		return { ask: false, analytics: development ? consoleAnalytics : silentAnalytics };
	}

	if (consent === 'granted') {
		return { ask: false, analytics: provider.start() };
	}

	return { ask: consent === null, analytics: silentAnalytics };
}
