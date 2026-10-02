/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DATA_SOURCE?: string;
	readonly VITE_API_URL?: string;
	/** "off" draws every driver, team and car picture instead of loading it from formula1.com. */
	readonly VITE_F1_MEDIA?: string;
}
