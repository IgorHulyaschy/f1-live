import { main } from './main.js';

process.on('unhandledRejection', (reason) => {
	console.error(reason);
});

await main();
