/**
 * @swagger
 * components:
 *   schemas:
 *     LogEntry:
 *       type: object
 *       properties:
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: When the log entry was created
 *         level:
 *           type: string
 *           enum: [error, warn, info, debug, trace]
 *           description: Log level severity
 *         message:
 *           type: string
 *           description: Log message
 *         context:
 *           type: object
 *           description: Additional contextual information
 */

const winston = require('winston');
const { format, transports } = winston;

// Define log format
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'pharaohs-api' },
  transports: [
    // Write logs to console
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(
          ({ timestamp, level, message, ...meta }) =>
            `${timestamp} [${level}]: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`
        )
      ),
    }),
    
    // Write logs to file (if in production)
    ...(process.env.NODE_ENV === 'production'
      ? [
          new transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
          new transports.File({
            filename: 'logs/combined.log',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

/**
 * Logger utility for consistent application logging
 */
module.exports = {
  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} [context] - Additional context
   */
  error: (message, context = {}) => {
    logger.error(message, context);
  },

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} [context] - Additional context
   */
  warn: (message, context = {}) => {
    logger.warn(message, context);
  },

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} [context] - Additional context
   */
  info: (message, context = {}) => {
    logger.info(message, context);
  },

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} [context] - Additional context
   */
  debug: (message, context = {}) => {
    logger.debug(message, context);
  },

  /**
   * Log HTTP request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Object} [additionalInfo] - Additional info to log
   */
  http: (req, res, additionalInfo = {}) => {
    logger.info(`HTTP ${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user ? req.user.id : null,
      userRole: req.user ? req.user.role : null,
      statusCode: res.statusCode,
      responseTime: res.responseTime,
      ...additionalInfo,
    });
  },
};
