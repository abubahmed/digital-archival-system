import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
});

export default logger;
export const createLogger = (options = {}) => pino(options);
export const getLogger = () => logger;
