import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = isDevelopment
  ? pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard'
        }
      }
    })
  : pino({
      level: process.env.LOG_LEVEL || 'info'
    });

export default logger;