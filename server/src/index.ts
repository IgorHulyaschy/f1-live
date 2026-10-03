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
		server.close().then(
			() => process.exit(0),
			(error: Error) => {
				console.error(error);
				process.exit(1);
			}
		);
	});
}

await server.listen();
