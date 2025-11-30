import { main } from "./main.js";
import WebSocket from "ws";

async function test() {
  process.on("unhandledRejection", (reason) => {
    console.log(reason);
  });
  try {
    const { liveTimingClient } = await main();
    // setTimeout(() => {
    //   liveTimingClient.stop();
    //   process.exit(0);
    // }, 5000);
  } catch (error) {
    console.log(error);
  }

  const connection = new WebSocket("ws://localhost:3001");
  connection.on("message", (message) => {
    console.log(message.toString());
  });
}
void test();
