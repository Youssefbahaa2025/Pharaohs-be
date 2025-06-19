/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// JWT configuration settings
module.exports = {
  // Secret key for signing JWT tokens
  secret: process.env.JWT_SECRET || 'pharaohs_secure_jwt_secret_please_change_in_production',
  
  // Token expiration time
  expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  
  // Refresh token settings
  refreshToken: {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  },
  
  // Verification options
  verifyOptions: {
    ignoreExpiration: false,
    algorithms: ['HS256']
  }
};
