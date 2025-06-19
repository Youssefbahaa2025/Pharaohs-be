const db = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const { getFullUrl, getCloudinaryPublicId, ensureCloudinaryUrl } = require('../utils/url.util');
const cloudinaryService = require('../services/cloudinary.service');

// ✅ Upload Media (Players Only)

exports.uploadMedia = async (req, res) => {
  try {
    console.log('[Upload Media] Starting media upload process');
    
    if (req.user.role !== 'player') {
      return res.status(403).json({ message: 'Only players can upload media.' });
    }

    const playerId = req.user.id;
    const file = req.file;
    const description = req.body.description || '';

    // Check if file is present
    if (!file) {
      console.error('[Upload Media] No file received');
      return res.status(400).json({ message: 'File is required' });
    }
    
    console.log(`[Upload Media] File received: ${file.originalname}, size: ${(file.size/1024).toFixed(2)}KB`);
    
    // Check Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('[Upload Media] Cloudinary configuration missing');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const type = file.mimetype.startsWith('image/') ? 'image' : 'video';
    console.log(`[Upload Media] Processing ${type} upload`);
    
    // Upload to Cloudinary directly from buffer
    const resourceType = type === 'image' ? 'image' : 'video';
    console.log(`[Upload Media] Starting Cloudinary upload with resource type: ${resourceType}`);
    
    const cloudinaryResult = await cloudinaryService.uploadBuffer(
      file.buffer, 
      file.originalname, 
      file.mimetype,
      {
        resource_type: resourceType,
        folder: `pharaohs/${type}s`, // Organize by type (images/videos)
        public_id: `player_${playerId}_${Date.now()}` // Ensure unique IDs
      }
    );
    
    console.log(`[Upload Media] Cloudinary upload successful, URL: ${cloudinaryResult.secure_url}`);
    
    // Store the Cloudinary URL and public_id in the database
    await db.query(
      'INSERT INTO videos (player_id, url, description, type, created_at, public_id) VALUES (?, ?, ?, ?, NOW(), ?)',
      [playerId, cloudinaryResult.secure_url, description, type, cloudinaryResult.public_id]
    );
    
    console.log(`[Upload Media] Database entry created successfully`);
    
    res.status(201).json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`,
      url: cloudinaryResult.secure_url,
      data: {
        url: cloudinaryResult.secure_url,
        filename: cloudinaryResult.original_filename || path.basename(cloudinaryResult.secure_url),
        type: file.mimetype,
        size: cloudinaryResult.bytes
      }
    });
  } catch (err) {
    console.error('[Upload Media Error]', err);
    
    // Provide more detailed error messages
    if (err.message && err.message.includes('payload too large')) {
      return res.status(413).json({ 
        message: 'File size too large. Maximum allowed size is 20MB.',
        error: 'PAYLOAD_TOO_LARGE' 
      });
    }
    
    if (err.message && err.message.includes('cloudinary')) {
      return res.status(500).json({ 
        message: 'Error uploading to cloud storage',
        error: 'CLOUDINARY_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: 'Server error during upload',
      error: err.message || 'UNKNOWN_ERROR'
    });
  }
};

// ✅ Get Profile (Player and Scout)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    // Base user data
    const [user] = await db.query(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = ?
    `, [userId]);

    if (!user.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    let profile = user[0];

    if (role === 'player') {
      // Get player profile data
      const [playerProfile] = await db.query(`
        SELECT position, club, bio, profile_image, date_of_birth, rating
        FROM player_profiles
        WHERE user_id = ?
      `, [userId]);

      if (playerProfile.length) {
        profile = {
          ...profile,
          position: playerProfile[0].position,
          club: playerProfile[0].club,
          bio: playerProfile[0].bio,
          profileImage: playerProfile[0].profile_image,
          date_of_birth: playerProfile[0].date_of_birth,
          rating: playerProfile[0].rating
        };
      }

      // Get player videos
      const [videos] = await db.query(`
        SELECT id, url, description, type, created_at, public_id
        FROM videos
        WHERE player_id = ?
      `, [userId]);

      profile.videos = videos.map(v => ({
        id: v.id.toString(),
        url: v.url,
        description: v.description,
        type: v.type || 'video',
        playerId: userId,
        createdAt: v.created_at,
        publicId: v.public_id
      }));
    } else if (role === 'scout') {
      // Get scout profile data
      const [scoutProfile] = await db.query(`
        SELECT organization, phone
        FROM scout_profiles
        WHERE user_id = ?
      `, [userId]);

      if (scoutProfile.length) {
        profile = {
          ...profile,
          organization: scoutProfile[0].organization,
          phone: scoutProfile[0].phone
        };
      }

      // Get shortlisted players
      const [shortlistedPlayers] = await db.query(`
        SELECT u.id, u.name, u.email, p.position, p.club, p.rating
        FROM shortlists s
        JOIN users u ON s.player_id = u.id
        LEFT JOIN player_profiles p ON u.id = p.user_id
        WHERE s.scout_id = ?
      `, [userId]);

      profile.shortlists = shortlistedPlayers;
    }

    res.json(profile);
  } catch (err) {
    console.error('[Get Profile Error]', err);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

// ✅ Like Video (Players and Scouts)
exports.likeVideo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required' });
    }

    // Check if video exists
    const [videoExists] = await db.query('SELECT id FROM videos WHERE id = ?', [videoId]);
    if (videoExists.length === 0) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if user already liked this video
    const [existingLike] = await db.query(
      'SELECT id FROM likes WHERE user_id = ? AND video_id = ?',
      [userId, videoId]
    );

    if (existingLike.length > 0) {
      return res.status(200).json({ message: 'Already liked this video', alreadyLiked: true });
    }

    // Get video owner and details for notification
    const [videoResult] = await db.query(
      'SELECT v.player_id, v.description, u.name AS liker_name FROM videos v JOIN users u ON u.id = ? WHERE v.id = ?',
      [userId, videoId]
    );

    // Add the like
    const [insertResult] = await db.query(
      'INSERT INTO likes (user_id, video_id) VALUES (?, ?)',
      [userId, videoId]
    );

    // Send notification to video owner if it's not the same user
    if (videoResult.length > 0 && videoResult[0].player_id != userId) {
      const NotificationUtil = require('../utils/notification.util');
      await NotificationUtil.createLikeNotification(
        videoResult[0].player_id,
        videoResult[0].liker_name,
        videoResult[0].description || 'your video'
      );
    }

    // Get updated like count
    const [likeCount] = await db.query(
      'SELECT COUNT(*) as count FROM likes WHERE video_id = ?',
      [videoId]
    );

    res.status(201).json({
      message: 'Liked video',
      likeCount: likeCount[0].count
    });
  } catch (err) {
    console.error('[Like Video Error]', err);
    res.status(500).json({ message: 'Failed to like video' });
  }
};

// ✅ Unlike Video (Players and Scouts)
exports.unlikeVideo = async (req, res) => {
  try {
    const userId = req.user.id;
    const videoId = req.params.videoId;

    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required' });
    }

    // Check if video exists
    const [videoExists] = await db.query('SELECT id FROM videos WHERE id = ?', [videoId]);
    if (videoExists.length === 0) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if the like exists
    const [existingLike] = await db.query(
      'SELECT id FROM likes WHERE user_id = ? AND video_id = ?',
      [userId, videoId]
    );

    if (existingLike.length === 0) {
      return res.status(200).json({ message: 'Not liked', alreadyUnliked: true });
    }

    // Delete the like
    const [result] = await db.query(
      'DELETE FROM likes WHERE user_id = ? AND video_id = ?',
      [userId, videoId]
    );

    // Get updated like count
    const [likeCount] = await db.query(
      'SELECT COUNT(*) as count FROM likes WHERE video_id = ?',
      [videoId]
    );

    res.json({
      message: 'Unliked video',
      likeCount: likeCount[0].count
    });
  } catch (err) {
    console.error('[UnlikeVideo] Error:', err);
    res.status(500).json({ message: 'Failed to unlike video' });
  }
};

// ✅ Fetch Video Likes (Players and Scouts)
exports.getVideoLikes = async (req, res) => {
  try {
    const userId = req.user.id;

    // First, get all videos
    const [videos] = await db.query('SELECT id FROM videos');
    const videoIds = videos.map(v => v.id);

    if (videoIds.length === 0) {
      return res.json([]);
    }

    // Get like counts for all videos
    const [likeCounts] = await db.query(`
      SELECT
        video_id,
        COUNT(*) AS likeCount
      FROM likes
      GROUP BY video_id
    `);

    // Create a map of video_id to like count
    const likeCountMap = {};
    likeCounts.forEach(count => {
      likeCountMap[count.video_id] = count.likeCount;
    });

    // Get user's likes
    const [userLikes] = await db.query(`
      SELECT video_id
      FROM likes
      WHERE user_id = ?
    `, [userId]);

    // Create a set of video_ids the user has liked
    const userLikedVideos = new Set(userLikes.map(like => like.video_id));

    // Combine the data
    const result = videoIds.map(videoId => ({
      video_id: videoId,
      likeCount: likeCountMap[videoId] || 0,
      likedByUser: userLikedVideos.has(videoId) ? 1 : 0
    }));

    res.json(result);
  } catch (err) {
    console.error('[Get Video Likes Error]', err);
    res.status(500).json({ message: 'Failed to fetch likes' });
  }
};

// ✅ Post Comment (Players Only)
exports.addComment = async (req, res) => {
  try {
    if (req.user.role !== 'player') {
      return res.status(403).json({ message: 'Only players can post comments.' });
    }

    const { videoId, content } = req.body;
    if (!videoId || !content?.trim()) {
      return res.status(400).json({ message: 'Video ID and comment content are required' });
    }

    // Get video owner and commenter details for notification
    const [videoResult] = await db.query(
      'SELECT v.player_id, v.description, u.name AS commenter_name FROM videos v JOIN users u ON u.id = ? WHERE v.id = ?',
      [req.user.id, videoId]
    );

    await db.query(
      'INSERT INTO comments (user_id, video_id, comment) VALUES (?, ?, ?)',
      [req.user.id, videoId, content.trim()]
    );

    // Send notification to video owner if it's not the same user
    if (videoResult.length > 0 && videoResult[0].player_id !== req.user.id) {
      const NotificationUtil = require('../utils/notification.util');
      await NotificationUtil.createCommentNotification(
        videoResult[0].player_id,
        videoResult[0].commenter_name,
        videoResult[0].description || 'your video'
      );
    }

    res.status(201).json({ message: 'Comment added' });
  } catch (err) {
    console.error('[Add Comment Error]', err);
    res.status(500).json({ message: 'Failed to add comment' });
  }
};

// ✅ Fetch Comments (Players and Scouts)
exports.getComments = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const [comments] = await db.query(`
      SELECT
        c.id, c.comment AS content, c.created_at,
        u.id AS user_id, u.name AS user_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.video_id = ?
      ORDER BY c.created_at ASC
    `, [videoId]);

    res.json(comments);
  } catch (err) {
    console.error('[Get Comments Error]', err);
    res.status(500).json({ message: 'Failed to load comments' });
  }
};

// ✅ Delete Comment (Players can delete their own comments, Admins can delete any)
exports.deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const commentId = req.params.commentId;

    // First, check if the comment exists and belongs to the user
    const [comment] = await db.query(
      'SELECT * FROM comments WHERE id = ?',
      [commentId]
    );

    if (!comment.length) {
      return res.status(404).json({ message: 'Comment not found or already deleted' });
    }

    // Check if user has permission to delete this comment
    const isCommentOwner = comment[0].user_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isCommentOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    // Delete the comment
    const [result] = await db.query('DELETE FROM comments WHERE id = ?', [commentId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Comment not found or already deleted' });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('[Delete Comment Error]', err);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
};

// ✅ Get Public Profile by ID (Public)
exports.getPublicProfileById = async (req, res) => {
  try {
    const playerId = req.params.id;
    const [profile] = await db.query(`
      SELECT
        u.id, u.name, u.email, u.role,
        p.position, p.club, p.bio, p.profile_image, p.rating,
        TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age
      FROM users u
      LEFT JOIN player_profiles p ON u.id = p.user_id
      WHERE u.id = ? AND u.role = 'player'
    `, [playerId]);

    if (!profile.length) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Get player media
    const [media] = await db.query(`
      SELECT id, url, description, type, created_at
      FROM videos WHERE player_id = ?
    `, [playerId]);

    // Get player stats if they exist
    const [stats] = await db.query(`
      SELECT matches_played, goals, assists, yellow_cards, red_cards
      FROM player_stats
      WHERE player_id = ?
    `, [playerId]);

    res.json({
      ...profile[0],
      profileImage: profile[0].profile_image ? ensureCloudinaryUrl(profile[0].profile_image) : null,
      videos: media.map(item => ({
        ...item, 
        url: ensureCloudinaryUrl(item.url)
      })),
      stats: stats.length > 0 ? stats[0] : null
    });
  } catch (err) {
    console.error('[Get Public Profile Error]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get Invitations (Players)
exports.getInvitations = async (req, res) => {
  try {
    const playerId = req.user.id;
    const [rows] = await db.query(`
      SELECT
        i.id AS invitation_id,
        i.status,
        t.id AS tryout_id,
        t.name AS tryout_name,
        t.location,
        t.date,
        u.id AS scout_id,
        u.name AS scout_name,
        u.email AS scout_email,
        sp.profile_image AS scout_profile_image
      FROM invitations i
      JOIN tryouts t ON i.tryout_id = t.id
      JOIN users u ON t.scout_id = u.id
      LEFT JOIN scout_profiles sp ON u.id = sp.user_id
      WHERE i.player_id = ?
      ORDER BY t.date DESC
    `, [playerId]);

    res.json(rows);
  } catch (err) {
    console.error('[Get Invitations Error]', err);
    res.status(500).json({ message: 'Failed to fetch invitations' });
  }
};

// ✅ Update Invitation Status (Players)
exports.updateInvitationStatus = async (req, res) => {
  try {
    const playerId = req.user.id;
    const invitationId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['accepted', 'declined'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Status must be accepted or declined' });
    }

    // Get invitation details for notification
    const [invitationDetails] = await db.query(
      `SELECT
        i.id, i.tryout_id, i.player_id,
        t.name AS tryout_name,
        u.id AS scout_id, u.name AS scout_name
      FROM invitations i
      JOIN tryouts t ON i.tryout_id = t.id
      JOIN users u ON t.scout_id = u.id
      WHERE i.id = ? AND i.player_id = ?`,
      [invitationId, playerId]
    );

    if (!invitationDetails.length) {
      return res.status(404).json({ message: 'Invitation not found or unauthorized' });
    }

    await db.query(
      'UPDATE invitations SET status = ? WHERE id = ?',
      [status, invitationId]
    );

    // Send notification to scout
    const NotificationUtil = require('../utils/notification.util');
    const playerName = (await db.query('SELECT name FROM users WHERE id = ?', [playerId]))[0][0]?.name || 'A player';

    await NotificationUtil.createCustomNotification(
      invitationDetails[0].scout_id,
      `${playerName} has ${status} your invitation to the tryout: ${invitationDetails[0].tryout_name}`
    );

    res.json({ message: `Invitation ${status} successfully` });
  } catch (err) {
    console.error('[Update Invitation Error]', err);
    res.status(500).json({ message: 'Could not update invitation' });
  }
};

// ✅ Get Videos (Players)
exports.getVideos = async (req, res) => {
  try {
    const playerId = req.user.id;
    const [media] = await db.query(
      'SELECT id, url, description, type, created_at, public_id FROM videos WHERE player_id = ? ORDER BY created_at DESC',
      [playerId]
    );

    res.json(media.map(item => ({
      ...item,
      url: ensureCloudinaryUrl(item.url), // Ensure we return a Cloudinary URL
      id: item.id.toString(),
      playerId: playerId.toString(),
      createdAt: item.created_at
    })));
  } catch (err) {
    console.error('[Get Media Error]', err);
    res.status(500).json({ message: 'Failed to load media' });
  }
};

// ✅ Update Profile (Players)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, position, club, bio, date_of_birth, updateType } = req.body;
    const file = req.file; // Will be undefined if no file is uploaded
    
    // Get current profile data to avoid losing information
    const [currentUserData] = await db.query(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    
    const [currentProfileData] = await db.query(
      'SELECT position, club, bio, profile_image, date_of_birth, public_id FROM player_profiles WHERE user_id = ?',
      [userId]
    );
    
    const currentProfile = currentProfileData.length > 0 ? currentProfileData[0] : {};
    
    // Handle profile image update only
    if (updateType === 'profileImageOnly' && file) {
      // Upload to Cloudinary directly from buffer
      const cloudinaryResult = await cloudinaryService.uploadBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        {
          resource_type: 'image',
          folder: 'pharaohs/profiles',
          public_id: `player_profile_${userId}_${Date.now()}`,
          transformation: [
            { width: 800, height: 800, crop: 'limit', quality: 'auto:good' }
          ]
        }
      );

      // Remove old image from Cloudinary if exists
      if (currentProfile.public_id) {
        try {
          await cloudinaryService.deleteFile(currentProfile.public_id);
        } catch (err) {
          console.warn(`[Delete Old Cloudinary Image Warning] ${err.message}`);
        }
      }
      
      await db.query(`
        INSERT INTO player_profiles (user_id, profile_image, public_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE profile_image = ?, public_id = ?
      `, [userId, cloudinaryResult.secure_url, cloudinaryResult.public_id, cloudinaryResult.secure_url, cloudinaryResult.public_id]);
      
      return res.json({ 
        message: 'Profile image updated successfully',
        profileImage: cloudinaryResult.secure_url
      });
    }
    
    // For regular updates, update the user's name if provided
    if (name) {
      await db.query(
        'UPDATE users SET name = ? WHERE id = ?',
        [name, userId]
      );
    }

    // Handle profile details
    let profileImage = null;
    let publicId = null;
    
    if (file) {
      // Upload to Cloudinary directly from buffer
      const cloudinaryResult = await cloudinaryService.uploadBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        {
          resource_type: 'image',
          folder: 'pharaohs/profiles',
          public_id: `player_profile_${userId}_${Date.now()}`,
          transformation: [
            { width: 800, height: 800, crop: 'limit', quality: 'auto:good' }
          ]
        }
      );

      // Remove old image from Cloudinary if exists
      if (currentProfile.public_id) {
        try {
          await cloudinaryService.deleteFile(currentProfile.public_id);
        } catch (err) {
          console.warn(`[Delete Old Cloudinary Image Warning] ${err.message}`);
        }
      }
      
      profileImage = cloudinaryResult.secure_url;
      publicId = cloudinaryResult.public_id;
    } else {
      // Retain existing profile image
      profileImage = currentProfile.profile_image || null;
      publicId = currentProfile.public_id || null;
    }
    
    // Use provided values or fall back to current values to avoid nullifying data
    const updatedPosition = position !== undefined ? position : currentProfile.position || '';
    const updatedClub = club !== undefined ? club : currentProfile.club || '';
    const updatedBio = bio !== undefined ? bio : currentProfile.bio || '';
    const updatedDOB = date_of_birth !== undefined ? date_of_birth : currentProfile.date_of_birth || null;

    await db.query(`
      INSERT INTO player_profiles (user_id, position, club, bio, profile_image, date_of_birth, public_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        position = ?,
        club = ?,
        bio = ?,
        profile_image = COALESCE(?, profile_image),
        date_of_birth = COALESCE(?, date_of_birth),
        public_id = COALESCE(?, public_id)
    `, [
      userId, updatedPosition, updatedClub, updatedBio, profileImage, updatedDOB, publicId,
      updatedPosition, updatedClub, updatedBio, profileImage, updatedDOB, publicId
    ]);

    // Build the response with updated profile data
    const updatedProfile = {
      name: name || currentUserData[0]?.name,
      position: updatedPosition,
      club: updatedClub,
      bio: updatedBio,
      date_of_birth: updatedDOB,
      profileImage: profileImage
    };

    res.json({ 
      message: 'Profile updated successfully',
      updatedProfile: updatedProfile
    });
  } catch (err) {
    console.error('[Update Profile Error]', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// ✅ Get All Players (For Scouts) - Enhanced with pagination
exports.getAllPlayers = async (req, res) => {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Extract filter parameters
    const { club, position, search, minRating } = req.query;

    // Build the base query with WHERE clause
    let baseQuery = "FROM users u LEFT JOIN player_profiles p ON u.id = p.user_id WHERE u.role = 'player'";
    let queryParams = [];

    // Add filter conditions if provided
    if (club) {
      baseQuery += " AND p.club = ?";
      queryParams.push(club);
    }

    if (position) {
      baseQuery += " AND p.position = ?";
      queryParams.push(position);
    }

    if (search) {
      baseQuery += " AND (u.name LIKE ? OR p.position LIKE ? OR p.club LIKE ?)";
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (minRating) {
      // Convert minRating to the new 1-5 scale if needed
      baseQuery += " AND p.rating IS NOT NULL AND p.rating >= ?";
      queryParams.push(parseFloat(minRating));
    }

    // Get total count for pagination metadata with the same filters
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total ${baseQuery}`,
      queryParams
    );
    const totalPlayers = countResult[0].total;

    // Get players with pagination
    const [players] = await db.query(`
      SELECT
        u.id, u.name, u.email, u.role,
        p.position, p.club, p.bio, p.profile_image, p.rating,
        TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age
      ${baseQuery}
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    const playerIds = players.map(player => player.id);

    // Get media for these players
    let media = [];
    if (playerIds.length > 0) {
      [media] = await db.query(`
        SELECT id, player_id, url, description, type, created_at
        FROM videos
        WHERE player_id IN (?)
      `, [playerIds]);
    }

    // Get player stats for these players
    let playerStats = [];
    if (playerIds.length > 0) {
      [playerStats] = await db.query(`
        SELECT player_id, matches_played, goals, assists, yellow_cards, red_cards
        FROM player_stats
        WHERE player_id IN (?)
      `, [playerIds]);
    }

    // Create a map of player stats for easy lookup
    const statsMap = {};
    playerStats.forEach(stat => {
      statsMap[stat.player_id] = {
        matches_played: stat.matches_played,
        goals: stat.goals,
        assists: stat.assists,
        yellow_cards: stat.yellow_cards,
        red_cards: stat.red_cards
      };
    });

    // Map players with their media and stats
    const playersWithMedia = players.map(player => ({
      ...player,
      role: 'player',
      rating: player.rating || 0,
      profileImage: player.profile_image ? ensureCloudinaryUrl(player.profile_image) : null,
      videos: media
        .filter(item => item.player_id === player.id)
        .map(item => ({
          id: item.id.toString(),
          url: ensureCloudinaryUrl(item.url),
          description: item.description,
          type: item.type,
          playerId: player.id.toString(),
          createdAt: item.created_at
        })),
      stats: statsMap[player.id] || null,
      hasStats: !!statsMap[player.id]
    }));

    // Return with pagination metadata
    res.json({
      players: playersWithMedia,
      pagination: {
        total: totalPlayers,
        page,
        limit,
        totalPages: Math.ceil(totalPlayers / limit)
      }
    });
  } catch (err) {
    console.error('[Get All Players Error]', err);
    res.status(500).json({ message: 'Failed to fetch players' });
  }
};

// ✅ Get Dashboard Data (All Roles)
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let data = {};
    if (role === 'player') {
      const [profile] = await db.query(`
        SELECT
          u.name,
          (SELECT COUNT(*) FROM videos v WHERE v.player_id = u.id) AS mediaCount,
          (SELECT COUNT(*) FROM invitations i WHERE i.player_id = u.id AND i.status = 'pending') AS pendingInvitations
        FROM users u
        WHERE u.id = ? AND u.role = 'player'
      `, [userId]);
      const [recentMedia] = await db.query(
        'SELECT url, description, type, created_at FROM videos WHERE player_id = ? ORDER BY created_at DESC LIMIT 3',
        [userId]
      );
      data = {
        ...profile[0],
        recentMedia
      };
    } else if (role === 'scout') {
      const [counts] = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM tryouts t WHERE t.scout_id = ?) AS tryoutCount,
          (SELECT COUNT(*) FROM invitations i JOIN tryouts t ON i.tryout_id = t.id WHERE t.scout_id = ?) AS invitationCount
        FROM dual
      `, [userId, userId]);
      const [recentTryouts] = await db.query(
        'SELECT name, location, date FROM tryouts WHERE scout_id = ? ORDER BY date DESC LIMIT 3',
        [userId]
      );
      data = {
        ...counts[0],
        recentTryouts
      };
    } else if (role === 'admin') {
      const [users] = await db.query('SELECT COUNT(*) AS userCount, role FROM users GROUP BY role');
      const [media] = await db.query('SELECT COUNT(*) AS mediaCount FROM videos');
      data = {
        totalUsers: users.reduce((acc, curr) => acc + curr.userCount, 0),
        userBreakdown: users,
        totalMedia: media[0].mediaCount
      };
    }

    res.json({ role, data });
  } catch (err) {
    console.error('[Get Dashboard Data Error]', err);
    res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
};

// ✅ Create Tryout (Scouts)
exports.createTryout = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { name, location, date } = req.body;

    if (!name || !location || !date) {
      return res.status(400).json({ message: 'Name, location, and date are required' });
    }

    const [result] = await db.query(
      'INSERT INTO tryouts (scout_id, name, location, date) VALUES (?, ?, ?, ?)',
      [scoutId, name, location, date]
    );

    res.status(201).json({ message: 'Tryout created successfully', tryoutId: result.insertId });
  } catch (err) {
    console.error('[Create Tryout Error]', err);
    res.status(500).json({ message: 'Failed to create tryout' });
  }
};

// ✅ Get Tryouts (Scouts)
exports.getTryouts = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const [tryouts] = await db.query(
      'SELECT id, name, location, date FROM tryouts WHERE scout_id = ? ORDER BY date DESC',
      [scoutId]
    );

    res.json(tryouts);
  } catch (err) {
    console.error('[Get Tryouts Error]', err);
    res.status(500).json({ message: 'Failed to fetch tryouts' });
  }
};

// ✅ Send Invitation (Scouts)
exports.sendInvitation = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { tryoutId, playerId } = req.body;

    if (!tryoutId || !playerId) {
      return res.status(400).json({ message: 'Tryout ID and Player ID are required' });
    }

    const [tryout] = await db.query('SELECT id FROM tryouts WHERE id = ? AND scout_id = ?', [tryoutId, scoutId]);
    if (!tryout.length) {
      return res.status(403).json({ message: 'Unauthorized or tryout not found' });
    }

    const [existing] = await db.query(
      'SELECT id FROM invitations WHERE tryout_id = ? AND player_id = ?',
      [tryoutId, playerId]
    );
    if (existing.length) {
      return res.status(400).json({ message: 'Invitation already sent' });
    }

    await db.query(
      'INSERT INTO invitations (tryout_id, player_id, status) VALUES (?, ?, ?)',
      [tryoutId, playerId, 'pending']
    );

    res.json({ message: 'Invitation sent successfully' });
  } catch (err) {
    console.error('[Send Invitation Error]', err);
    res.status(500).json({ message: 'Failed to send invitation' });
  }
};

// ✅ Get Filter Options
exports.getFilterOptions = async (_, res) => {
  try {
    // Get all unique positions
    const [positions] = await db.query(`
      SELECT DISTINCT position
      FROM player_profiles
      WHERE position IS NOT NULL AND position != ''
      ORDER BY position
    `);

    // Get all unique clubs
    const [clubs] = await db.query(`
      SELECT DISTINCT club
      FROM player_profiles
      WHERE club IS NOT NULL AND club != ''
      ORDER BY club
    `);

    // Get age range
    const [ageRange] = await db.query(`
      SELECT
        MIN(TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())) AS minAge,
        MAX(TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())) AS maxAge
      FROM player_profiles
      WHERE date_of_birth IS NOT NULL
    `);

    res.json({
      positions: positions.map(p => p.position),
      clubs: clubs.map(c => c.club),
      ageRange: ageRange[0] || { minAge: 15, maxAge: 40 } // Default range if no data
    });
  } catch (err) {
    console.error('[Get Filter Options Error]', err);
    res.status(500).json({ message: 'Failed to load filter options' });
  }
};

// ✅ Get Scout Invitations (Scouts)
exports.getScoutInvitations = async (req, res) => {
  try {
    if (req.user.role !== 'scout') {
      return res.status(403).json({ message: 'Only scouts can access invitations.' });
    }

    const scoutId = req.user.id;
    const [invitations] = await db.query(`
      SELECT
        i.id AS invitation_id,
        i.status,
        i.created_at,
        t.id AS tryout_id,
        t.name AS tryout_name,
        t.location,
        t.date,
        p.id AS player_id,
        u.name AS player_name,
        u.email AS player_email
      FROM invitations i
      JOIN tryouts t ON i.tryout_id = t.id
      JOIN users u ON i.player_id = u.id
      JOIN player_profiles p ON u.id = p.user_id
      WHERE t.scout_id = ?
      ORDER BY i.created_at DESC
    `, [scoutId]);

    res.status(200).json(invitations);
  } catch (err) {
    console.error('[Get Scout Invitations Error]', err);
    res.status(500).json({ message: 'Failed to fetch scout invitations' });
  }
};

// ✅ Delete Video (Players Only)
exports.deleteVideo = async (req, res) => {
  try {
    const playerId = req.user.id;
    const videoId = req.params.id;

    const [video] = await db.query(
      'SELECT * FROM videos WHERE id = ? AND player_id = ?',
      [videoId, playerId]
    );

    if (!video.length) {
      return res.status(404).json({ message: 'Video not found or unauthorized' });
    }

    // If the video has a Cloudinary public_id, delete it from Cloudinary
    if (video[0].public_id) {
      try {
        await cloudinaryService.deleteFile(video[0].public_id, {
          resource_type: video[0].type === 'image' ? 'image' : 'video'
        });
      } catch (cloudinaryError) {
        console.warn('[Delete from Cloudinary Warning]', cloudinaryError.message);
      }
    } else if (video[0].url && !video[0].url.includes('cloudinary')) {
      // If it's a local file, try to delete it
      try {
        const filePath = path.join(__dirname, '..', '..', video[0].url.replace(/^\//, ''));
        await fs.unlink(filePath);
      } catch (fileErr) {
        console.warn('[Delete Video File Warning]', fileErr.message);
      }
    }

    await db.query('DELETE FROM videos WHERE id = ?', [videoId]);
    res.json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('[Delete Video Error]', err);
    res.status(500).json({ message: 'Failed to delete video' });
  }
};

// ✅ Update Video Description (Players Only)
exports.updateVideo = async (req, res) => {
  try {
    const playerId = req.user.id;
    const videoId = req.params.id;
    const { description } = req.body;

    if (description === undefined) {
      return res.status(400).json({ message: 'Description is required' });
    }

    // Check if video exists and belongs to the player
    const [video] = await db.query(
      'SELECT * FROM videos WHERE id = ? AND player_id = ?',
      [videoId, playerId]
    );

    if (!video.length) {
      return res.status(404).json({ message: 'Video not found or unauthorized' });
    }

    // Update the video description
    await db.query('UPDATE videos SET description = ? WHERE id = ?', [description, videoId]);

    res.json({
      message: 'Video updated successfully',
      video: {
        id: video[0].id,
        description: description,
        url: video[0].url.startsWith('http') ? video[0].url : `http://localhost:3000${video[0].url}`,
        type: video[0].type,
        playerId: playerId.toString(),
        createdAt: video[0].created_at
      }
    });
  } catch (err) {
    console.error('[Update Video Error]', err);
    res.status(500).json({ message: 'Failed to update video' });
  }
};

// ✅ Get Player Stats (Players)
exports.getPlayerStats = async (req, res) => {
  try {
    const playerId = req.user.id;

    const [mediaCount] = await db.query(
      'SELECT COUNT(*) as count FROM videos WHERE player_id = ?',
      [playerId]
    );

    const [invitationCount] = await db.query(
      'SELECT COUNT(*) as count FROM invitations WHERE player_id = ?',
      [playerId]
    );

    const [pendingCount] = await db.query(
      'SELECT COUNT(*) as count FROM invitations WHERE player_id = ? AND status = "pending"',
      [playerId]
    );

    // Get performance stats
    const [performanceStats] = await db.query(
      'SELECT matches_played, goals, assists, yellow_cards, red_cards FROM player_stats WHERE player_id = ?',
      [playerId]
    );

    // Get player rating from profile
    const [profileData] = await db.query(
      'SELECT rating FROM player_profiles WHERE user_id = ?',
      [playerId]
    );

    const rating = profileData.length > 0 ? profileData[0].rating : 0;

    res.json({
      mediaCount: mediaCount[0].count,
      invitationCount: invitationCount[0].count,
      pendingCount: pendingCount[0].count,
      performanceStats: performanceStats.length > 0 ? performanceStats[0] : null,
      rating: rating
    });
  } catch (err) {
    console.error('[Get Player Stats Error]', err);
    res.status(500).json({ message: 'Failed to fetch player stats' });
  }
};

// ✅ Update Player Performance Stats (Players)
exports.updatePerformanceStats = async (req, res) => {
  try {
    const playerId = req.user.id;
    const { matches_played, goals, assists, yellow_cards, red_cards } = req.body;

    // Validate input
    if (matches_played === undefined || goals === undefined ||
        assists === undefined || yellow_cards === undefined ||
        red_cards === undefined) {
      return res.status(400).json({ message: 'All statistics fields are required' });
    }

    // Ensure all values are non-negative integers
    const stats = { matches_played, goals, assists, yellow_cards, red_cards };
    for (const [key, value] of Object.entries(stats)) {
      if (value < 0 || !Number.isInteger(Number(value))) {
        return res.status(400).json({ message: `${key} must be a non-negative integer` });
      }
    }

    // Calculate player rating using the same formula as in the frontend (1-5 scale)
    let rating = 1; // Default minimum rating
    if (matches_played > 0) {
      const numerator = (goals * 2) + assists - yellow_cards - (red_cards * 3);
      const denominator = matches_played;
      const rawRating = numerator / denominator;

      // Convert to 1-5 scale using the same formula as frontend
      // First scale to 0-4 range, then add 1 to get 1-5
      let scaledRating = (rawRating + 3) / 6 * 4 + 1;

      // Ensure rating is between 1-5
      rating = Math.max(1, Math.min(5, scaledRating));
    }

    // Check if stats record exists
    const [existing] = await db.query(
      'SELECT id FROM player_stats WHERE player_id = ?',
      [playerId]
    );

    if (existing.length > 0) {
      // Update existing record
      await db.query(`
        UPDATE player_stats
        SET matches_played = ?, goals = ?, assists = ?, yellow_cards = ?, red_cards = ?, updated_at = CURRENT_TIMESTAMP
        WHERE player_id = ?
      `, [matches_played, goals, assists, yellow_cards, red_cards, playerId]);
    } else {
      // Create new record
      await db.query(`
        INSERT INTO player_stats (player_id, matches_played, goals, assists, yellow_cards, red_cards)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [playerId, matches_played, goals, assists, yellow_cards, red_cards]);
    }

    // Update the player rating in the player_profiles table
    await db.query(`
      UPDATE player_profiles
      SET rating = ?
      WHERE user_id = ?
    `, [rating, playerId]);

    console.log(`Player ${playerId} rating updated to ${rating.toFixed(2)}`);

    res.json({
      message: 'Performance statistics updated successfully',
      stats: { matches_played, goals, assists, yellow_cards, red_cards },
      rating: rating.toFixed(2)
    });
  } catch (err) {
    console.error('[Update Performance Stats Error]', err);
    res.status(500).json({ message: 'Failed to update performance statistics' });
  }
};

// ✅ Delete Profile Picture (Players Only)
exports.deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch the current profile image path and public_id
    const [profile] = await db.query(
      'SELECT profile_image, public_id FROM player_profiles WHERE user_id = ?',
      [userId]
    );
    
    if (!profile.length || !profile[0].profile_image) {
      return res.status(404).json({ message: 'No profile image found' });
    }
    
    // Delete image from Cloudinary if public_id exists
    if (profile[0].public_id) {
      try {
        await cloudinaryService.deleteFile(profile[0].public_id);
        console.log(`Deleted profile image from Cloudinary: ${profile[0].public_id}`);
      } catch (cloudinaryError) {
        console.warn('[Delete Cloudinary Image Warning]', cloudinaryError.message);
      }
    } else if (profile[0].profile_image && !profile[0].profile_image.includes('cloudinary')) {
      // If it's a local file, try to delete it
      try {
        const filePath = path.join(__dirname, '..', profile[0].profile_image);
        await fs.unlink(filePath);
        console.log(`Deleted local profile image file: ${filePath}`);
      } catch (fileErr) {
        console.warn('[Delete Profile Image File Warning]', fileErr.message);
      }
    }
    
    // Update the database to remove the reference
    await db.query(
      'UPDATE player_profiles SET profile_image = NULL, public_id = NULL WHERE user_id = ?',
      [userId]
    );
    
    res.json({ message: 'Profile picture deleted successfully' });
  } catch (err) {
    console.error('[Delete Profile Picture Error]', err);
    res.status(500).json({ message: 'Failed to delete profile picture' });
  }
};

module.exports = exports;