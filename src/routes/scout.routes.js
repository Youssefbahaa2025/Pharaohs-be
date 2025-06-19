const express = require('express');
const router = express.Router();
const controller = require('../controllers/scout.controller');
const auth = require('../middlewares/auth.middleware');
const role = require('../middlewares/role.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * @swagger
 * components:
 *   schemas:
 *     Tryout:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Tryout ID
 *         name:
 *           type: string
 *           description: Name of the tryout event
 *         location:
 *           type: string
 *           description: Location where the tryout will take place
 *         date:
 *           type: string
 *           format: date-time
 *           description: Date and time of the tryout
 *         playersInvited:
 *           type: array
 *           items:
 *             type: integer
 *           description: IDs of players invited to the tryout
 *     ShortlistedPlayer:
 *       type: object
 *       properties:
 *         player_id:
 *           type: integer
 *           description: Player ID
 *         name:
 *           type: string
 *           description: Player's name
 *         email:
 *           type: string
 *           description: Player's email
 *         role:
 *           type: string
 *           description: User role (always 'player')
 *     FilterOptions:
 *       type: object
 *       properties:
 *         positions:
 *           type: array
 *           items:
 *             type: string
 *           description: Available player positions
 *         clubs:
 *           type: array
 *           items:
 *             type: string
 *           description: Available clubs
 */

// All scout routes require login and role: scout

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'C:\\Users\\pc\\Desktop\\Pharaohs\\Pharaohs-Back-end\\uploads\\images';
    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  }
});

/**
 * @swagger
 * /api/scout/tryouts:
 *   post:
 *     summary: Create a new tryout with date and time
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *               - date
 *               - time
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tryout name
 *               location:
 *                 type: string
 *                 description: Tryout location
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Tryout date (YYYY-MM-DD)
 *               time:
 *                 type: string
 *                 description: Tryout time (HH:MM:SS)
 *     responses:
 *       201:
 *         description: Tryout created successfully
 *       400:
 *         description: All fields required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Error creating tryout with time
 *   get:
 *     summary: Get all tryouts created by the scout
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tryouts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tryout'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Error fetching tryouts
 */

/**
 * @swagger
 * /api/scout/tryouts/{tryoutId}:
 *   put:
 *     summary: Update an existing tryout
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tryoutId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the tryout to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *               - date
 *               - time
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tryout name
 *               location:
 *                 type: string
 *                 description: Tryout location
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Tryout date (YYYY-MM-DD)
 *               time:
 *                 type: string
 *                 description: Tryout time (HH:MM:SS)
 *     responses:
 *       200:
 *         description: Tryout updated successfully
 *       400:
 *         description: All fields required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout or not the owner of this tryout
 *       500:
 *         description: Error updating tryout
 *   delete:
 *     summary: Delete a tryout
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tryoutId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the tryout to delete
 *     responses:
 *       200:
 *         description: Tryout deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout or not the owner of this tryout
 *       500:
 *         description: Error deleting tryout
 */
router.post('/tryouts', auth, role('scout'), controller.createTryoutWithTime);
router.get('/tryouts', auth, role('scout'), controller.getTryouts);
router.put('/tryouts/:tryoutId', auth, role('scout'), controller.updateTryout);
router.delete('/tryouts/:tryoutId', auth, role('scout'), controller.deleteTryout);

/**
 * @swagger
 * /api/scout/invite:
 *   post:
 *     summary: Invite a player to a tryout
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tryout_id
 *               - player_id
 *             properties:
 *               tryout_id:
 *                 type: integer
 *                 description: ID of the tryout
 *               player_id:
 *                 type: integer
 *                 description: ID of the player to invite
 *     responses:
 *       201:
 *         description: Player invited successfully
 *       400:
 *         description: Tryout and Player IDs are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout or not the owner of this tryout
 *       409:
 *         description: Player already invited to this tryout
 *       500:
 *         description: Invitation failed
 */
router.post('/invite', auth, role('scout'), controller.invitePlayer);

/**
 * @swagger
 * /api/scout/invitations/{invitationId}:
 *   delete:
 *     summary: Cancel an invitation sent to a player
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the invitation to cancel
 *     responses:
 *       200:
 *         description: Invitation canceled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout or not the owner of this invitation
 *       404:
 *         description: Invitation not found
 *       500:
 *         description: Error canceling invitation
 */
router.delete('/invitations/:invitationId', auth, role('scout'), controller.cancelInvitation);

/**
 * @swagger
 * /api/scout/shortlist:
 *   post:
 *     summary: Add a player to scout's shortlist
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - player_id
 *             properties:
 *               player_id:
 *                 type: integer
 *                 description: ID of the player to shortlist
 *     responses:
 *       201:
 *         description: Player added to shortlist
 *       400:
 *         description: Player ID is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       409:
 *         description: Player already shortlisted
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get scout's shortlisted players
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of shortlisted players
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ShortlistedPlayer'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Failed to load shortlist
 */
router.post('/shortlist', auth, role('scout'), controller.addToShortlist);
router.get('/shortlist', auth, role('scout'), controller.getShortlist);

/**
 * @swagger
 * /api/scout/shortlist/{playerId}:
 *   delete:
 *     summary: Remove a player from scout's shortlist
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the player to remove from shortlist
 *     responses:
 *       200:
 *         description: Player removed from shortlist
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Failed to remove player
 */
router.delete('/shortlist/:playerId', auth, role('scout'), controller.removeFromShortlist);

/**
 * @swagger
 * /api/scout/search:
 *   get:
 *     summary: Search and filter players
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by player name
 *       - in: query
 *         name: position
 *         schema:
 *           type: string
 *         description: Filter by player position
 *       - in: query
 *         name: club
 *         schema:
 *           type: string
 *         description: Filter by player's club
 *       - in: query
 *         name: minAge
 *         schema:
 *           type: integer
 *         description: Minimum age of players
 *       - in: query
 *         name: maxAge
 *         schema:
 *           type: integer
 *         description: Maximum age of players
 *       - in: query
 *         name: hasVideos
 *         schema:
 *           type: boolean
 *         description: Filter players who have uploaded videos
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, age, position]
 *         description: Field to sort results by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order (ascending or descending)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Search results with pagination metadata
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Server error during search
 */
router.get('/search', auth, role('scout'), controller.searchPlayers);

/**
 * @swagger
 * /api/scout/filter-options:
 *   get:
 *     summary: Get available filter options for player search
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Filter options
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FilterOptions'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Failed to fetch filter options
 */
router.get('/filter-options', auth, role('scout'), controller.getFilterOptions);

/**
 * @swagger
 * /api/scout/locations:
 *   get:
 *     summary: Get all unique locations from tryouts
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of unique locations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Failed to fetch locations
 */
router.get('/locations', auth, role('scout'), controller.getLocations);

/**
 * @swagger
 * /api/scout/profile:
 *   get:
 *     summary: Get scout profile
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scout profile data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Failed to fetch profile
 *   put:
 *     summary: Update scout profile
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Scout's name
 *               organization:
 *                 type: string
 *                 description: Scout's organization/club
 *               phone:
 *                 type: string
 *                 description: Scout's phone
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: Scout's profile image
 *               updateType:
 *                 type: string
 *                 enum: [profileImageOnly, fullProfile]
 *                 description: Type of update to perform
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Failed to update profile
 */
router.get('/profile', auth, role('scout'), controller.getProfile);
router.put('/profile', auth, role('scout'), upload.single('profileImage'), controller.updateScoutProfile);

/**
 * @swagger
 * /api/scout/profile/picture:
 *   delete:
 *     summary: Delete scout profile picture
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile picture deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not a scout
 *       500:
 *         description: Failed to delete profile picture
 */
router.delete('/profile/picture', auth, role('scout'), controller.deleteProfilePicture);

/**
 * @swagger
 * /api/scout/debug-players:
 *   get:
 *     summary: Debug endpoint to get player data
 *     tags: [Scout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Debug player data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a scout
 *       500:
 *         description: Server error
 */
router.get('/debug-players', auth, role('scout'), controller.debugPlayerData);

// Public routes (no auth required)
/**
 * @swagger
 * /api/scout/public-profile/{scoutId}:
 *   get:
 *     summary: Get public scout profile
 *     tags: [Scout]
 *     parameters:
 *       - in: path
 *         name: scoutId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the scout
 *     responses:
 *       200:
 *         description: Scout profile data
 *       404:
 *         description: Scout not found
 *       500:
 *         description: Failed to fetch profile
 */
router.get('/public-profile/:scoutId', controller.getPublicScoutProfile);

/**
 * @swagger
 * /api/scout/public-tryouts/{scoutId}:
 *   get:
 *     summary: Get public tryouts by scout ID
 *     tags: [Scout]
 *     parameters:
 *       - in: path
 *         name: scoutId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the scout
 *     responses:
 *       200:
 *         description: List of tryouts
 *       404:
 *         description: Scout not found
 *       500:
 *         description: Failed to fetch tryouts
 */
router.get('/public-tryouts/:scoutId', controller.getPublicScoutTryouts);

module.exports = router;
