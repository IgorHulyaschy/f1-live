import { loadConfig } from './config.js';
import { createServer } from './main.js';

process.on('unhandledRejection', (reason) => {
	console.error(reason);
});

/** Orchestrators send SIGKILL after their own grace period (10 s by default); exit before that. */
const SHUTDOWN_TIMEOUT_MS = 8000;

const config = loadConfig();

const server = await createServer(config);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.once(signal, () => {
		server.app.log.info({ signal }, 'stopping');
		setTimeout(() => {
			console.error(`Shutdown took longer than ${SHUTDOWN_TIMEOUT_MS} ms; exiting.`);
			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS).unref();
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
