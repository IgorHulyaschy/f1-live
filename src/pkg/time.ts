export function parseTime(time: string) {
  if (time.includes(":")) {
    const [minutes, secondsMillis] = time.split(":");
    const [seconds, milliseconds] = secondsMillis.split(".");

    return (
      parseInt(minutes) * 60 * 1000 +
      parseInt(seconds) * 1000 +
      parseInt(milliseconds) * 10
    );
  } else {
    const [seconds, milliseconds] = time.split(".");

    return parseInt(seconds) * 1000 + parseInt(milliseconds) * 10;
  }
}
