/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DATA_SOURCE?: string;
	readonly VITE_API_URL?: string;
	readonly VITE_WS_URL?: string;
	/** Where the accounts API lives when it is not under /api on the app's own origin. */
	readonly VITE_ACCOUNTS_URL?: string;
	/** "off" draws every driver, team and car picture instead of loading it from formula1.com. */
	readonly VITE_F1_MEDIA?: string;
	/** "link" lets viewers open team radio clips from the official archive; off by default. */
	readonly VITE_TEAM_RADIO?: string;
}
