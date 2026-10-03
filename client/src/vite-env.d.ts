/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DATA_SOURCE?: string;
	readonly VITE_API_URL?: string;
	readonly VITE_WS_URL?: string;
	/** Where the accounts API lives when it is not under /api on the app's own origin. */
	readonly VITE_ACCOUNTS_URL?: string;
	/** "off" draws every driver, team and car picture instead of loading it from formula1.com. */
	readonly VITE_F1_MEDIA?: string;
	/** Which analytics provider to start after consent (src/platform/analytics.ts); unset runs none. */
	readonly VITE_ANALYTICS_PROVIDER?: string;
	/** "true" keeps search engines out: robots.txt disallows everything and pages say noindex. */
	readonly VITE_SITE_NOINDEX?: string;
}
