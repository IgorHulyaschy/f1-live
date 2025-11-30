import { main } from "./main.js";

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
}
void test();
