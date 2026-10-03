import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** The server with accounts on; `/api` goes there, so sign-in cookies stay first-party. */
const accountsServer = process.env.ACCOUNTS_SERVER_URL ?? 'http://127.0.0.1:3000';

const proxy = { '/api': accountsServer };

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: { proxy },
	preview: { proxy },
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	}
});
