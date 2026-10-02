function requireEnv(name: string): string {
	const value = process.env[name];

	if (!value) {
		throw new Error(`Missing required environment variable ${name}`);
	}

	return value;
}

export const config = {
	app: {
		port: Number(process.env.PORT ?? 3000),
		wsPort: Number(process.env.WS_PORT ?? 3001)
	},
	database: {
		url: requireEnv('DATABASE_URL')
	},
	livetiming: {
		negotiateUrl: 'https://livetiming.formula1.com/signalrcore/negotiate',
		connectionUrl: 'wss://livetiming.formula1.com/signalrcore'
	}
};
