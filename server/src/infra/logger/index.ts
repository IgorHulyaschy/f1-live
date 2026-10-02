export class Logger {
	info(message: string) {
		process.stdout.write(`${message}\n`);
	}

	error(message: string | Error) {
		console.error(message);
	}
}
