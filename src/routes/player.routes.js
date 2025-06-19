const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const upload = require('../services/upload.service');
const controller = require('../controllers/player.controller');
const role = require('../middlewares/role.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Video:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The video ID
 *         url:
 *           type: string
 *           description: URL to the video file
 *         description:
 *           type: string
 *           description: Description of the video
 *         type:
 *           type: string
 *           enum: [video, image]
 *           description: Type of media (video or image)
 *         playerId:
 *           type: string
 *           description: ID of the player who uploaded the video
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the video was uploaded
 *     Profile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *         name: 
 *           type: string
 *           description: Full name
 *         email:
 *           type: string
 *           description: Email address
 *         role:
 *           type: string
 *           description: User role (player, scout, admin)
 *         position:
 *           type: string
 *           description: Player's position
 *         club:
 *           type: string
 *           description: Player's club
 *         bio:
 *           type: string
 *           description: Player's biography
 *         profileImage:
 *           type: string
 *           description: URL to profile image
 *         age:
 *           type: integer
 *           description: Player's age
 *         videos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Video'
 *     PlayerStats:
 *       type: object
 *       properties:
 *         matches_played:
 *           type: integer
 *           description: Number of matches played
 *         goals:
 *           type: integer
 *           description: Number of goals scored
 *         assists:
 *           type: integer
 *           description: Number of assists
 *         yellow_cards:
 *           type: integer
 *           description: Number of yellow cards
 *         red_cards:
 *           type: integer
 *           description: Number of red cards
 *     Invitation:
 *       type: object
 *       properties:
 *         invitation_id:
 *           type: integer
 *           description: Invitation ID
 *         status:
 *           type: string
 *           enum: [pending, accepted, declined]
 *           description: Status of the invitation
 *         tryout_name:
 *           type: string
 *           description: Name of the tryout
 *         location:
 *           type: string
 *           description: Location of the tryout
 *         date:
 *           type: string
 *           format: date-time
 *           description: Date and time of the tryout
 *         scout_name:
 *           type: string
 *           description: Name of the scout who sent the invitation
 *         scout_email:
 *           type: string
 *           description: Email of the scout who sent the invitation
 */

/**
 * @swagger
 * /api/player/dashboard:
 *   get:
 *     summary: Get player dashboard data
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/dashboard', auth, controller.getDashboardData);

/**
 * @swagger
 * /api/player/profile:
 *   get:
 *     summary: Get current player profile
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not a player or scout
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Failed to fetch profile
 *   put:
 *     summary: Update player profile
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               position:
 *                 type: string
 *               club:
 *                 type: string
 *               bio:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               profileImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not a player
 *       500:
 *         description: Failed to update profile
 */
router.get('/profile', auth, role(['player', 'scout']), controller.getProfile);
router.put('/profile', auth, role('player'), upload.single('profileImage'), controller.updateProfile);

/**
 * @swagger
 * /api/player/public-profile/{id}:
 *   get:
 *     summary: Get player public profile by ID
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Player ID
 *     responses:
 *       200:
 *         description: Public profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Player not found
 *       500:
 *         description: Server error
 */
router.get('/public-profile/:id', auth, controller.getPublicProfileById);

/**
 * @swagger
 * /api/player/all:
 *   get:
 *     summary: Get all players with pagination
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of players with pagination metadata
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch players
 */
router.get('/all', auth, controller.getAllPlayers);

/**
 * @swagger
 * /api/player/videos:
 *   get:
 *     summary: Get player's videos
 *     tags: [Player, Videos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Video'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not a player or scout
 *       500:
 *         description: Failed to load media
 */
router.get('/videos', auth, role(['player', 'scout']), controller.getVideos);

/**
 * @swagger
 * /api/player/upload:
 *   post:
 *     summary: Upload media (video or image)
 *     tags: [Player, Videos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Video or image file
 *               description:
 *                 type: string
 *                 description: Description of the media
 *     responses:
 *       201:
 *         description: Media uploaded successfully
 *       400:
 *         description: File is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players can upload media
 *       500:
 *         description: Server error during upload
 */
// Custom error handler for multer errors
const handleUploadErrors = (err, req, res, next) => {
  console.error('[Upload Error]', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      message: 'File size too large. Maximum allowed size is 20MB.',
      error: 'FILE_TOO_LARGE'
    });
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(415).json({ 
      message: err.message,
      error: 'INVALID_FILE_TYPE'
    });
  }
  return next(err);
};

// Special media upload handling to avoid JSON parsing conflicts
router.post('/upload', auth, role('player'), (req, res, next) => {
  console.log('[Upload Route] Content-Type:', req.headers['content-type']);
  
  // Process multipart form data with explicit error handling
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Upload Route] Multer error:', err.message);
      return handleUploadErrors(err, req, res, next);
    }
    
    // Validate file was uploaded
    if (!req.file) {
      console.error('[Upload Route] No file received');
      return res.status(400).json({ message: 'File is required' });
    }
    
    console.log('[Upload Route] File received successfully:', req.file.originalname);
    next();
  });
}, controller.uploadMedia);

/**
 * @swagger
 * /api/player/videos/comment:
 *   post:
 *     summary: Add a comment to a video
 *     tags: [Player, Videos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoId
 *               - content
 *             properties:
 *               videoId:
 *                 type: integer
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       400:
 *         description: Video ID and comment content are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players can post comments
 *       500:
 *         description: Failed to add comment
 */
router.post('/videos/comment', auth, role('player'), controller.addComment);

/**
 * @swagger
 * /api/player/videos/comment/{videoId}:
 *   get:
 *     summary: Get comments for a video
 *     tags: [Player, Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to load comments
 */
router.get('/videos/comment/:videoId', auth, controller.getComments);

/**
 * @swagger
 * /api/player/videos/comment/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Player, Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Failed to delete comment
 */
router.delete('/videos/comment/:commentId', auth, controller.deleteComment);

/**
 * @swagger
 * /api/player/videos/like:
 *   post:
 *     summary: Like a video
 *     tags: [Player, Videos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoId
 *             properties:
 *               videoId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Video liked successfully
 *       200:
 *         description: Already liked this video
 *       400:
 *         description: Video ID is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players and scouts can like videos
 *       404:
 *         description: Video not found
 *       500:
 *         description: Failed to like video
 */
router.post('/videos/like', auth, role(['player', 'scout']), controller.likeVideo);

/**
 * @swagger
 * /api/player/videos/like/{videoId}:
 *   delete:
 *     summary: Unlike a video
 *     tags: [Player, Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video unliked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players and scouts can unlike videos
 *       404:
 *         description: Video not found or like not found
 *       500:
 *         description: Failed to unlike video
 */
router.delete('/videos/like/:videoId', auth, role(['player', 'scout']), controller.unlikeVideo);

/**
 * @swagger
 * /api/player/videos/likes:
 *   get:
 *     summary: Get video likes
 *     tags: [Player, Videos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Video likes retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players and scouts can view likes
 *       500:
 *         description: Failed to get video likes
 */
router.get('/videos/likes', auth, role(['player', 'scout']), controller.getVideoLikes);

/**
 * @swagger
 * /api/player/invitations:
 *   get:
 *     summary: Get player's tryout invitations
 *     tags: [Player, Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invitation'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players can access invitations
 *       500:
 *         description: Failed to fetch invitations
 */
router.get('/invitations', auth, role('player'), controller.getInvitations);

/**
 * @swagger
 * /api/player/invitations/{id}:
 *   put:
 *     summary: Update invitation status (accept/decline)
 *     tags: [Player, Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Invitation ID
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
 *                 enum: [accepted, declined]
 *     responses:
 *       200:
 *         description: Invitation status updated successfully
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players can update invitations
 *       404:
 *         description: Invitation not found
 *       500:
 *         description: Failed to update invitation
 */
router.put('/invitations/:id', auth, role('player'), controller.updateInvitationStatus);

/**
 * @swagger
 * /api/player/invitations/send:
 *   post:
 *     summary: Send invitation to a player
 *     tags: [Player, Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerId
 *               - tryoutId
 *             properties:
 *               playerId:
 *                 type: integer
 *               tryoutId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *       400:
 *         description: Player ID and tryout ID are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only scouts can send invitations
 *       409:
 *         description: Invitation already exists
 *       500:
 *         description: Failed to send invitation
 */
router.post('/invitations/send', auth, role('scout'), controller.sendInvitation);

/**
 * @swagger
 * /api/player/scout-invitations:
 *   get:
 *     summary: Get scout's sent invitations
 *     tags: [Player, Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scout invitations retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only scouts can access scout invitations
 *       500:
 *         description: Failed to fetch scout invitations
 */
router.get('/scout-invitations', auth, role('scout'), controller.getScoutInvitations);

/**
 * @swagger
 * /api/player/tryouts:
 *   post:
 *     summary: Create a new tryout
 *     tags: [Player, Tryouts]
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
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Tryout created successfully
 *       400:
 *         description: Name, location, and date are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only scouts can create tryouts
 *       500:
 *         description: Failed to create tryout
 *   get:
 *     summary: Get scout's tryouts
 *     tags: [Player, Tryouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tryouts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only scouts can access tryouts
 *       500:
 *         description: Failed to fetch tryouts
 */
router.post('/tryouts', auth, role('scout'), controller.createTryout);
router.get('/tryouts', auth, role('scout'), controller.getTryouts);

/**
 * @swagger
 * /api/player/videos/{id}:
 *   delete:
 *     summary: Delete a video
 *     tags: [Player, Videos]
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players can delete videos
 *       404:
 *         description: Video not found or unauthorized
 *       500:
 *         description: Failed to delete video
 */
router.delete('/videos/:id', auth, role('player'), controller.deleteVideo);

/**
 * @swagger
 * /api/player/videos/{id}:
 *   put:
 *     summary: Update a video's description
 *     tags: [Player, Videos]
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
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 description: New description for the video
 *     responses:
 *       200:
 *         description: Video updated successfully
 *       400:
 *         description: Description is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players can update videos
 *       404:
 *         description: Video not found or unauthorized
 *       500:
 *         description: Failed to update video
 */
router.put('/videos/:id', auth, role('player'), controller.updateVideo);

/**
 * @swagger
 * /api/player/stats:
 *   get:
 *     summary: Get player's performance stats
 *     tags: [Player, Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerStats'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players can access performance stats
 *       404:
 *         description: Player stats not found
 *       500:
 *         description: Failed to fetch player stats
 */
router.get('/stats', auth, role('player'), controller.getPlayerStats);

/**
 * @swagger
 * /api/player/performance-stats:
 *   post:
 *     summary: Update player's performance stats
 *     tags: [Player, Stats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               matches_played:
 *                 type: integer
 *               goals:
 *                 type: integer
 *               assists:
 *                 type: integer
 *               yellow_cards:
 *                 type: integer
 *               red_cards:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Performance stats updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only players can update performance stats
 *       500:
 *         description: Failed to update performance stats
 */
router.post('/performance-stats', auth, role('player'), controller.updatePerformanceStats);

/**
 * @swagger
 * /api/player/filter-options:
 *   get:
 *     summary: Get player filter options
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Filter options retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch filter options
 */
router.get('/filter-options', auth, controller.getFilterOptions);

/**
 * @swagger
 * /api/player/profile/picture:
 *   delete:
 *     summary: Delete player profile picture
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile picture deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, not a player
 *       500:
 *         description: Failed to delete profile picture
 */
router.delete('/profile/picture', auth, role('player'), controller.deleteProfilePicture);

module.exports = router;