/**
 * @swagger
 * components:
 *   schemas:
 *     ServerError:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 *         stack:
 *           type: string
 *           description: Error stack trace (only in development environment)
 *         errorCode:
 *           type: string
 *           description: Unique error code for tracking (if available)
 */

/**
 * Global error handling middleware
 * This middleware catches all errors thrown in the application
 * Formats error responses and logs errors appropriately
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
module.exports = (err, req, res, next) => {
  // Log error details for debugging
  console.error('[Error]', err.message);
  console.error(err.stack);

  // Generate a unique error tracking code
  const errorCode = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
  // Default status code and message
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong';
  
  // Create response object
  const errorResponse = {
    message: message,
    errorCode: errorCode
  };
  
  // Only include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse);
};
