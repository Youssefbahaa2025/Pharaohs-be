/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT Authorization header using the Bearer scheme
 */

/**
 * Authentication middleware for protecting routes
 * Expects a JWT token in the Authorization header in the format: "Bearer <token>"
 * If valid, adds the decoded user information to req.user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('[AuthMiddleware] No token provided');
    return res.status(401).json({ message: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret, jwtConfig.verifyOptions);
    req.user = decoded;
    next();
  } catch (err) {
    console.log('[AuthMiddleware] Token verification failed:', err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};