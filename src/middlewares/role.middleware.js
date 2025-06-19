/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 */

/**
 * Role-based authorization middleware
 * Checks if the authenticated user has the required role(s)
 * Must be used after auth middleware as it depends on req.user being set
 * 
 * @param {string|string[]} roles - Required role(s) for accessing the route
 * @returns {Function} Express middleware function
 */
module.exports = (roles) => {
  // Convert to array if single role was provided
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    // Check if the user's role is in the allowed roles
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Required role: ' + roles.join(' or ') 
      });
    }
    next();
  };
};
