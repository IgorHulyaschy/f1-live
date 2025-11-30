export const config = {
  database: {
    url: process.env.DATABASE_URL!,
  },
  livetiming: {
    negotiateUrl: "https://livetiming.formula1.com/signalrcore/negotiate",
    connectionUrl: "wss://livetiming.formula1.com/signalrcore",
  },
};
