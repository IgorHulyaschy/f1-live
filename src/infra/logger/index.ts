export class Logger {
  info(message: string) {
    console.log(message);
  }

  error(message: string | Error) {
    console.error(message);
  }
}