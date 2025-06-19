/**
 * @swagger
 * components:
 *   schemas:
 *     TokenPayload:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *         role:
 *           type: string
 *           description: User role
 *         iat:
 *           type: integer
 *           description: Issued at timestamp
 *         exp:
 *           type: integer
 *           description: Expiration timestamp
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const jwtConfig = require('../config/jwt');
const db = require('../config/db');

/**
 * Authentication service for handling user authentication and token operations
 */
const authService = {
  /**
   * Generate JWT token for user
   * @param {Object} user - User object with id, name, email, role
   * @returns {string} JWT token
   */
  generateToken: (user) => {
    const payload = {
      id: user.id,
      role: user.role
    };
    return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
  },

  /**
   * Generate refresh token
   * @param {Object} user - User object with id
   * @returns {string} Refresh token
   */
  generateRefreshToken: (user) => {
    const payload = {
      id: user.id,
      type: 'refresh'
    };
    return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.refreshToken.expiresIn });
  },

  /**
   * Verify JWT token and return decoded payload
   * @param {string} token - JWT token to verify
   * @returns {Object|null} Decoded token payload or null if invalid
   */
  verifyToken: (token) => {
    try {
      return jwt.verify(token, jwtConfig.secret);
    } catch (error) {
      return null;
    }
  },

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  hashPassword: async (password) => {
    return await bcrypt.hash(password, 10);
  },

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} True if password matches
   */
  comparePassword: async (password, hash) => {
    return await bcrypt.compare(password, hash);
  },

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  getUserByEmail: async (email) => {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return users.length ? users[0] : null;
  },

  /**
   * Get user by ID
   * @param {number} id - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  getUserById: async (id) => {
    const [users] = await db.query('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?', [id]);
    return users.length ? users[0] : null;
  }
};

module.exports = authService;
