const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin.controller');
const auth = require('../middlewares/auth.middleware');
const role = require('../middlewares/role.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *         name:
 *           type: string
 *           description: User's full name
 *         email:
 *           type: string
 *           description: User's email
 *         role:
 *           type: string
 *           description: User's role (player, scout, admin)
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *           description: User account status
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the user was created
 *     AdminVideo:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Video ID
 *         url:
 *           type: string
 *           description: URL to the video
 *         description:
 *           type: string
 *           description: Video description
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the video was uploaded
 *         playerId:
 *           type: integer
 *           description: ID of the player who uploaded the video
 *         player_name:
 *           type: string
 *           description: Name of the player who uploaded the video
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           description: Video approval status
 *     SystemLog:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Log ID
 *         user_id:
 *           type: integer
 *           description: ID of the user who performed the action
 *         user_name:
 *           type: string
 *           description: Name of the user who performed the action
 *         action:
 *           type: string
 *           enum: [DELETE, UPDATE, RESET_PASSWORD, CREATE]
 *           description: Type of action performed
 *         entity_type:
 *           type: string
 *           enum: [user, video, other]
 *           description: Type of entity that was affected
 *         entity_id:
 *           type: integer
 *           description: ID of the entity that was affected
 *         details:
 *           type: string
 *           description: Additional details about the action
 *         ip_address:
 *           type: string
 *           description: IP address of the user who performed the action
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the action was performed
 */

// Middleware to apply to all routes
router.use(auth);
router.use(role('admin'));

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Failed to load users
 */
router.get('/users', controller.getAllUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Could not delete user
 */
router.delete('/users/:id', controller.deleteUser);

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     summary: Update user status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *     responses:
 *       200:
 *         description: User status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User status updated
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Could not update user status
 */
router.put('/users/:id/status', controller.updateUserStatus);

/**
 * @swagger
 * /api/admin/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset
 *                 tempPassword:
 *                   type: string
 *                   description: Temporary password for the user
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Could not reset password
 */
router.post('/users/:id/reset-password', controller.resetUserPassword);

/**
 * @swagger
 * /api/admin/media:
 *   get:
 *     summary: Get all videos
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all videos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AdminVideo'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Failed to fetch media
 */
router.get('/media', controller.getAllVideos);

/**
 * @swagger
 * /api/admin/media/{id}:
 *   delete:
 *     summary: Delete a video
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Video deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Could not delete video
 */
router.delete('/media/:id', controller.deleteVideo);

/**
 * @swagger
 * /api/admin/media/{id}/status:
 *   put:
 *     summary: Update video status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: Video status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Video status updated
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Could not update video status
 */
router.put('/media/:id/status', controller.updateVideoStatus);

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Get system logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs until this date
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [DELETE, UPDATE, RESET_PASSWORD, CREATE]
 *         description: Filter logs by action type
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [user, video, other]
 *         description: Filter logs by entity type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter logs by user ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of logs to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of system logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SystemLog'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Failed to fetch logs
 */
router.get('/logs', controller.getSystemLogs);

/**
 * @swagger
 * /api/admin/locations:
 *   get:
 *     summary: Get all tryout locations
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all tryout locations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Failed to load locations
 *   post:
 *     summary: Add a new tryout location
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - location
 *             properties:
 *               location:
 *                 type: string
 *                 description: Name of the location
 *     responses:
 *       201:
 *         description: Location added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Location added successfully
 *                 location:
 *                   type: string
 *                   description: The added location name
 *       400:
 *         description: Location name is required or Location already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Failed to add location
 */
router.get('/locations', controller.getTryoutLocations);
router.post('/locations', controller.addTryoutLocation);

/**
 * @swagger
 * /api/admin/locations/{location}:
 *   delete:
 *     summary: Delete a tryout location
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: location
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the location to delete
 *     responses:
 *       200:
 *         description: Location deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Location deleted successfully
 *       400:
 *         description: Location name is required or Cannot delete location that is in use
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not an admin
 *       500:
 *         description: Failed to delete location
 */
router.delete('/locations/:location', controller.deleteTryoutLocation);

module.exports = router;
