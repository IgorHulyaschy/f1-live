import { main } from "./main.js";

async function test() {
  process.on("unhandledRejection", (reason) => {
    // eslint-disable-next-line no-console
    console.log(reason);
  });
  await main();
}

void test();
