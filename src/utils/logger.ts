import pino from "pino";

const logger = pino(
  {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  }
  //   pino.destination(`${__dirname}/src/pino/app.log`)
);

export default logger;
