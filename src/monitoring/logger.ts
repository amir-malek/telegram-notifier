import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction ? jsonFormat : consoleFormat
  })
];

// Add file transport in production
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFormat
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonFormat
    })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  format: isProduction ? jsonFormat : consoleFormat,
  defaultMeta: {
    service: 'notification-service',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports,
  // Don't exit on handled exceptions
  exitOnError: false
});

// Handle uncaught exceptions and rejections
if (isProduction) {
  logger.exceptions.handle(
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  );

  logger.rejections.handle(
    new winston.transports.File({ filename: 'logs/rejections.log' })
  );
}

// Create a stream object for HTTP request logging
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Helper functions for structured logging
export const logError = (message: string, error: Error, meta?: any) => {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...meta
  });
};

export const logRequest = (method: string, url: string, statusCode: number, responseTime: number, meta?: any) => {
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    ...meta
  });
};

export const logNotification = (action: string, notificationId: string, channel: string, meta?: any) => {
  logger.info(`Notification ${action}`, {
    notificationId,
    channel,
    ...meta
  });
};

export const logQueue = (action: string, jobId: string, jobType: string, meta?: any) => {
  logger.info(`Queue ${action}`, {
    jobId,
    jobType,
    ...meta
  });
};

export const logAuth = (action: string, clientId?: string, meta?: any) => {
  logger.info(`Auth ${action}`, {
    clientId,
    ...meta
  });
};