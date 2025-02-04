/**
 * Configures and exports a Pino logger instance.
 *
 * @example
 * log.info("Server started");
 * log.error("An error occurred");
 */

import pino from "pino";
const log = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

export default log;
