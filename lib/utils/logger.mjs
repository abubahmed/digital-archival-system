const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};

const getTimestamp = () => {
    return new Date().toISOString();
};

const formatMessage = (level, color, symbol, ...args) => {
    const timestamp = getTimestamp();
    const levelStr = `${color}${symbol} ${level.toUpperCase()}${colors.reset}`;
    const timeStr = `${colors.dim}${timestamp}${colors.reset}`;
    return `${timeStr} ${levelStr} ${args.join(' ')}`;
};

const log = {
    info: (...args) => {
        console.log(formatMessage('info', colors.cyan, 'ℹ', ...args));
    },

    success: (...args) => {
        console.log(formatMessage('success', colors.green, '✓', ...args));
    },

    warn: (...args) => {
        console.warn(formatMessage('warn', colors.yellow, '⚠', ...args));
    },

    error: (...args) => {
        console.error(formatMessage('error', colors.red, '✗', ...args));
    },

    debug: (...args) => {
        console.log(formatMessage('debug', colors.magenta, '🔍', ...args));
    },

    trace: (...args) => {
        console.log(formatMessage('trace', colors.dim, '→', ...args));
    },

    child: (bindings) => {
        const prefix = Object.entries(bindings)
            .map(([k, v]) => `${colors.blue}${k}${colors.reset}=${colors.bright}${v}${colors.reset}`)
            .join(' ');
        return {
            info: (...args) => log.info(`[${prefix}]`, ...args),
            success: (...args) => log.success(`[${prefix}]`, ...args),
            warn: (...args) => log.warn(`[${prefix}]`, ...args),
            error: (...args) => log.error(`[${prefix}]`, ...args),
            debug: (...args) => log.debug(`[${prefix}]`, ...args),
            trace: (...args) => log.trace(`[${prefix}]`, ...args),
        };
    },
};

export default log;
export const createLogger = () => log;
export const getLogger = () => log;
