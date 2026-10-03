import { loadConfig } from './config.js';
import { createServer } from './main.js';

process.on('unhandledRejection', (reason) => {
	console.error(reason);
});

const config = loadConfig();

const server = await createServer(config);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.once(signal, () => {
		server.app.log.info({ signal }, 'stopping');
		void server.close().then(() => process.exit(0));
	});
}

await server.listen();
