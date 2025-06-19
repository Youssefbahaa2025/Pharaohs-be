const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;
const { getFullUrl, getCloudinaryPublicId, ensureCloudinaryUrl } = require('../utils/url.util');
const cloudinaryService = require('../services/cloudinary.service');

exports.createTryout = async (req, res) => {
  const { name, location, date } = req.body;
  const scoutId = req.user.id;

  if (!name || !location || !date)
    return res.status(400).json({ message: 'All fields required' });

  try {
    await db.query(
      'INSERT INTO tryouts (scout_id, name, location, date) VALUES (?, ?, ?, ?)',
      [scoutId, name, location, date]
    );
    res.status(201).json({ message: 'Tryout created' });
  } catch (err) {
    res.status(500).json({ message: 'Error creating tryout' });
  }
};

exports.createTryoutWithTime = async (req, res) => {
  const { name, location, date, time } = req.body;
  const scoutId = req.user.id;

  if (!name || !location || !date || !time)
    return res.status(400).json({ message: 'All fields required' });

  try {
    const dateTime = `${date} ${time}`;
    await db.query(
      'INSERT INTO tryouts (scout_id, name, location, date) VALUES (?, ?, ?, ?)',
      [scoutId, name, location, dateTime]
    );
    res.status(201).json({ message: 'Tryout created with time' });
  } catch (err) {
    res.status(500).json({ message: 'Error creating tryout with time' });
  }
};

exports.getTryouts = async (req, res) => {
  const scoutId = req.user.id;

  try {
    const [tryouts] = await db.query(
      'SELECT id, name, location, date FROM tryouts WHERE scout_id = ? ORDER BY date DESC',
      [scoutId]
    );

    for (const tryout of tryouts) {
      const [invited] = await db.query(
        'SELECT player_id FROM invitations WHERE tryout_id = ?',
        [tryout.id]
      );
      tryout.playersInvited = invited.map(row => row.player_id);
    }

    res.json(tryouts);
  } catch (err) {
    console.error('[Get Tryouts Error]', err);
    res.status(500).json({ message: 'Error fetching tryouts' });
  }
};

exports.updateTryout = async (req, res) => {
  const scoutId = req.user.id;
  const tryoutId = req.params.tryoutId;
  const { name, location, date, time } = req.body;

  if (!name || !location || !date || !time) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    // First check if the tryout belongs to this scout
    const [tryout] = await db.query(
      'SELECT id FROM tryouts WHERE id = ? AND scout_id = ?',
      [tryoutId, scoutId]
    );

    if (!tryout.length) {
      return res.status(403).json({ message: 'You do not have permission to update this tryout' });
    }

    // Update the tryout
    const dateTime = `${date} ${time}`;
    await db.query(
      'UPDATE tryouts SET name = ?, location = ?, date = ? WHERE id = ?',
      [name, location, dateTime, tryoutId]
    );

    res.json({ message: 'Tryout updated successfully' });
  } catch (err) {
    console.error('[Update Tryout Error]', err);
    res.status(500).json({ message: 'Error updating tryout' });
  }
};

exports.deleteTryout = async (req, res) => {
  const scoutId = req.user.id;
  const tryoutId = req.params.tryoutId;

  try {
    // First check if the tryout belongs to this scout
    const [tryout] = await db.query(
      'SELECT id FROM tryouts WHERE id = ? AND scout_id = ?',
      [tryoutId, scoutId]
    );

    if (!tryout.length) {
      return res.status(403).json({ message: 'You do not have permission to delete this tryout' });
    }

    // Delete related invitations first (foreign key constraint)
    await db.query('DELETE FROM invitations WHERE tryout_id = ?', [tryoutId]);

    // Delete the tryout
    await db.query('DELETE FROM tryouts WHERE id = ?', [tryoutId]);

    res.json({ message: 'Tryout deleted successfully' });
  } catch (err) {
    console.error('[Delete Tryout Error]', err);
    res.status(500).json({ message: 'Error deleting tryout' });
  }
};


exports.invitePlayer = async (req, res) => {
    const scoutId = req.user.id;
    const { tryout_id, player_id } = req.body;

    if (!tryout_id || !player_id) {
      return res.status(400).json({ message: 'Tryout and Player IDs are required' });
    }

    try {
      // Get scout name and tryout details for notification
      const [scoutAndTryout] = await db.query(
        'SELECT u.name AS scout_name, t.name AS tryout_name FROM users u JOIN tryouts t ON t.scout_id = u.id WHERE t.id = ? AND t.scout_id = ?',
        [tryout_id, scoutId]
      );

      if (!scoutAndTryout.length) {
        return res.status(403).json({ message: 'You are not the owner of this tryout' });
      }

      // Prevent duplicate invite
      const [existing] = await db.query(
        'SELECT id FROM invitations WHERE tryout_id = ? AND player_id = ?',
        [tryout_id, player_id]
      );
      if (existing.length) {
        return res.status(409).json({ message: 'Player already invited to this tryout' });
      }

      // Insert new invitation
      await db.query(
        'INSERT INTO invitations (tryout_id, player_id, status) VALUES (?, ?, ?)',
        [tryout_id, player_id, 'pending']
      );

      // Send notification to player
      const NotificationUtil = require('../utils/notification.util');
      await NotificationUtil.createInvitationNotification(
        player_id,
        scoutAndTryout[0].scout_name,
        scoutAndTryout[0].tryout_name
      );

      res.status(201).json({ message: 'Player invited successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Invitation failed' });
    }
  };

// Cancel an invitation sent to a player
exports.cancelInvitation = async (req, res) => {
  const scoutId = req.user.id;
  const invitationId = req.params.invitationId;

  if (!invitationId) {
    return res.status(400).json({ message: 'Invitation ID is required' });
  }

  try {
    // Check if the invitation exists and belongs to this scout
    const [invitation] = await db.query(
      `SELECT i.id, i.tryout_id, i.player_id, i.status, u.name AS player_name, t.name AS tryout_name
       FROM invitations i
       JOIN tryouts t ON i.tryout_id = t.id
       JOIN users u ON i.player_id = u.id
       WHERE i.id = ? AND t.scout_id = ?`,
      [invitationId, scoutId]
    );

    if (!invitation.length) {
      return res.status(404).json({ message: 'Invitation not found or unauthorized' });
    }

    // Check if the invitation is already accepted or declined
    if (invitation[0].status !== 'pending') {
      return res.status(400).json({
        message: `Cannot cancel an invitation that has been ${invitation[0].status.toLowerCase()}`
      });
    }

    // Delete the invitation
    await db.query('DELETE FROM invitations WHERE id = ?', [invitationId]);

    // Send notification to player
    const NotificationUtil = require('../utils/notification.util');
    await NotificationUtil.createCustomNotification(
      invitation[0].player_id,
      `Your invitation to the tryout "${invitation[0].tryout_name}" has been canceled`
    );

    res.status(200).json({ message: 'Invitation canceled successfully' });
  } catch (err) {
    console.error('[Cancel Invitation Error]', err);
    res.status(500).json({ message: 'Error canceling invitation' });
  }
};

exports.addToShortlist = async (req, res) => {
    const scoutId = req.user.id;
    const { player_id } = req.body;

    if (!player_id) return res.status(400).json({ message: 'Player ID is required' });

    try {
      // Get scout details for notification
      const [scoutDetails] = await db.query(
        'SELECT u.name AS scout_name, s.organization AS club_name FROM users u LEFT JOIN scout_profiles s ON u.id = s.user_id WHERE u.id = ?',
        [scoutId]
      );

      const [existing] = await db.query(
        'SELECT id FROM shortlists WHERE scout_id = ? AND player_id = ?',
        [scoutId, player_id]
      );
      if (existing.length) return res.status(409).json({ message: 'Player already shortlisted' });

      await db.query(
        'INSERT INTO shortlists (scout_id, player_id) VALUES (?, ?)',
        [scoutId, player_id]
      );

      // Send notification to player
      if (scoutDetails.length > 0) {
        const NotificationUtil = require('../utils/notification.util');
        await NotificationUtil.createShortlistNotification(
          player_id,
          scoutDetails[0].scout_name,
          scoutDetails[0].club_name || 'Unknown Club'
        );
      }

      res.status(201).json({ message: 'Player added to shortlist' });
    } catch (err) {
      console.error('[Add to Shortlist Error]', err);
      res.status(500).json({ message: 'Server error' });
    }
  };

  exports.getShortlist = async (req, res) => {
    const scoutId = req.user.id;

    try {
      const [rows] = await db.query(`
        SELECT
          u.id AS player_id, u.name, u.email, u.role
        FROM shortlists s
        JOIN users u ON s.player_id = u.id
        WHERE s.scout_id = ?
      `, [scoutId]);

      res.json(rows);
    } catch (err) {
      console.error('[Get Shortlist Error]', err);
      res.status(500).json({ message: 'Failed to load shortlist' });
    }
  };

  exports.removeFromShortlist = async (req, res) => {
    const scoutId = req.user.id;
    const playerId = req.params.playerId;

    try {
      await db.query(
        'DELETE FROM shortlists WHERE scout_id = ? AND player_id = ?',
        [scoutId, playerId]
      );
      res.json({ message: 'Player removed from shortlist' });
    } catch (err) {
      console.error('[Remove Shortlist Error]', err);
      res.status(500).json({ message: 'Failed to remove player' });
    }
  };
  exports.searchPlayers = async (req, res) => {
    try {
      // Extract all filter parameters from query
      const {
        name,
        position,
        club,
        minAge,
        maxAge,
        hasVideos,
        minRating,
        sortBy,
        sortOrder,
        limit = 20,
        offset = 0
      } = req.query;

      // Parameters array for prepared statement
      const params = [req.user.id]; // First parameter is the scout_id for isShortlisted

      // Build the base query
      let query = `
        SELECT
          u.id, u.name, u.email, u.created_at AS createdAt,
          p.position, p.club, p.bio, p.profile_image, p.rating,
          TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
          (SELECT COUNT(*) FROM videos v WHERE v.player_id = u.id) AS videoCount,
          (SELECT COUNT(*) FROM shortlists s WHERE s.player_id = u.id AND s.scout_id = ?) AS isShortlisted,
          (SELECT COUNT(*) FROM player_stats ps WHERE ps.player_id = u.id) AS hasStats
        FROM users u
        LEFT JOIN player_profiles p ON u.id = p.user_id
        WHERE u.role = 'player'
      `;

      // Simple conditions on user table
      if (name) {
        query += " AND LOWER(u.name) LIKE ?";
        params.push(`%${name.toLowerCase()}%`);
      }

      // Handle position filtering
      if (position) {
        query += " AND p.position = ?";
        params.push(position);
      }

      // Handle club filtering
      if (club) {
        query += " AND p.club = ?";
        params.push(club);
      }

      // Handle age range filtering
      if (minAge !== undefined && minAge !== null) {
        query += " AND TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) >= ?";
        params.push(parseInt(minAge));
      }

      if (maxAge !== undefined && maxAge !== null) {
        query += " AND TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) <= ?";
        params.push(parseInt(maxAge));
      }

      // Handle "has videos" filter
      if (hasVideos === 'true' || hasVideos === true) {
        query += " AND EXISTS (SELECT 1 FROM videos v WHERE v.player_id = u.id)";
      }

      // Handle minimum rating filter
      if (minRating !== undefined && minRating !== null) {
        query += " AND p.rating IS NOT NULL AND p.rating >= ?";
        params.push(parseFloat(minRating));
      }

      // Handle sorting
      let orderBy = "ORDER BY u.name";
      if (sortBy) {
        switch (sortBy) {
          case 'name':
            orderBy = "ORDER BY u.name";
            break;
          case 'age':
            orderBy = "ORDER BY age";
            break;
          case 'rating':
            orderBy = "ORDER BY p.rating";
            break;
          case 'club':
            orderBy = "ORDER BY p.club";
            break;
          case 'position':
            orderBy = "ORDER BY p.position";
            break;
          default:
            orderBy = "ORDER BY u.name";
        }

        if (sortOrder && sortOrder.toLowerCase() === 'desc') {
          orderBy += " DESC";
        } else {
          orderBy += " ASC";
        }
      }

      query += ` ${orderBy} LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      // Execute the query
      const [players] = await db.query(query, params);

      // Get total count for pagination with the same filters (excluding limit/offset)
      let countQuery = `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN player_profiles p ON u.id = p.user_id
        WHERE u.role = 'player'
      `;

      const countParams = []; // No scout_id needed for count

      // Apply the same filters to the count query
      if (name) {
        countQuery += " AND LOWER(u.name) LIKE ?";
        countParams.push(`%${name.toLowerCase()}%`);
      }

      if (position) {
        countQuery += " AND p.position = ?";
        countParams.push(position);
      }

      if (club) {
        countQuery += " AND p.club = ?";
        countParams.push(club);
      }

      if (minAge !== undefined && minAge !== null) {
        countQuery += " AND TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) >= ?";
        countParams.push(parseInt(minAge));
      }

      if (maxAge !== undefined && maxAge !== null) {
        countQuery += " AND TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) <= ?";
        countParams.push(parseInt(maxAge));
      }

      if (hasVideos === 'true' || hasVideos === true) {
        countQuery += " AND EXISTS (SELECT 1 FROM videos v WHERE v.player_id = u.id)";
      }

      // Add minRating filter to the count query
      if (minRating !== undefined && minRating !== null) {
        countQuery += " AND p.rating IS NOT NULL AND p.rating >= ?";
        countParams.push(parseFloat(minRating));
      }

      const [countResult] = await db.query(countQuery, countParams);

      // Enhance player objects with additional data
      const enhancedPlayers = await Promise.all(players.map(async (player) => {
        // Get player stats if they exist
        const [stats] = await db.query(`
          SELECT matches_played, goals, assists, yellow_cards, red_cards
          FROM player_stats
          WHERE player_id = ?
        `, [player.id]);

        // Get a sample of player videos
        const [videos] = await db.query(`
          SELECT id, url, type
          FROM videos
          WHERE player_id = ?
          LIMIT 3
        `, [player.id]);

        return {
          ...player,
          profile_image: player.profile_image ?
            ensureCloudinaryUrl(player.profile_image) :
            null,
          stats: stats.length > 0 ? stats[0] : null,
          videos: videos.map(v => ({
            ...v,
            url: ensureCloudinaryUrl(v.url)
          }))
        };
      }));

      // Return the results with pagination info
      const limitNum = parseInt(limit) || 20;
      const offsetNum = parseInt(offset) || 0;

      res.json({
        players: enhancedPlayers,
        pagination: {
          total: countResult[0].total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < countResult[0].total
        }
      });
    } catch (err) {
      console.error('[Search Players Error]', err);
      res.status(500).json({ message: 'Search failed', error: err.message });
    }
  };


exports.getProfile = async (req, res) => {
  const scoutId = req.user.id;

  try {
    const [[scout]] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, s.organization, s.phone, s.profile_image, u.created_at AS createdAt
      FROM users u
      LEFT JOIN scout_profiles s ON u.id = s.user_id
      WHERE u.id = ?
    `, [scoutId]);

    if (!scout) return res.status(404).json({ message: 'Scout not found' });

    const [shortlists] = await db.query(`
      SELECT
        u.id, u.name, u.email, u.created_at AS createdAt,
        p.position, p.club, p.bio
      FROM shortlists s
      JOIN users u ON s.player_id = u.id
      LEFT JOIN player_profiles p ON u.id = p.user_id
      WHERE s.scout_id = ?
    `, [scoutId]);

    scout.shortlists = shortlists;

    // Format the profile image URL using utility
    if (scout.profile_image) {
      scout.profileImage = ensureCloudinaryUrl(scout.profile_image);
    } else {
      scout.profileImage = null;
    }

    // Remove the original profile_image property to avoid duplication
    delete scout.profile_image;

    res.json(scout);
  } catch (err) {
    console.error('[Scout Profile Error]', err);
    res.status(500).json({ message: 'Failed to load profile' });
  }
};

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

    // Use default age range if no data is available
    const defaultAgeRange = { minAge: 15, maxAge: 40 };
    const actualAgeRange = ageRange[0] && ageRange[0].minAge !== null ?
                           ageRange[0] :
                           defaultAgeRange;

    res.json({
      positions: positions.map(p => p.position),
      clubs: clubs.map(c => c.club),
      ageRange: actualAgeRange
    });
  } catch (err) {
    console.error('[Get Filter Options Error]', err);
    res.status(500).json({ message: 'Failed to load filter options' });
  }
};

// Get all unique locations from tryouts
exports.getLocations = async (req, res) => {
  try {
    const [locations] = await db.query(`
      SELECT DISTINCT location
      FROM tryouts
      WHERE location IS NOT NULL AND location != ''
      ORDER BY location
    `);

    res.json(locations.map(l => l.location));
  } catch (err) {
    console.error('[Get Locations Error]', err);
    res.status(500).json({ message: 'Failed to load locations' });
  }
};

exports.debugPlayerData = async (req, res) => {
  try {
    // Check total users
    const [userCount] = await db.query('SELECT COUNT(*) as total, role FROM users GROUP BY role');

    // Check player profiles
    const [profileCount] = await db.query(`
      SELECT COUNT(*) as total FROM player_profiles
    `);

    // Check the missing profiles
    const [missingProfiles] = await db.query(`
      SELECT u.id, u.name, u.email
      FROM users u
      LEFT JOIN player_profiles p ON u.id = p.user_id
      WHERE u.role = 'player' AND p.user_id IS NULL
    `);

    res.json({
      userCounts: userCount,
      profileCount: profileCount[0],
      missingProfiles,
      message: 'Debug data fetched successfully'
    });
  } catch (err) {
    console.error('[Debug Player Data Error]', err);
    res.status(500).json({ message: 'Error fetching debug data', error: err.message });
  }
};

exports.updateScoutProfile = async (req, res) => {
  const scoutId = req.user.id;
  const { name, organization, phone, updateType } = req.body;
  const file = req.file; // Will be undefined if no file is uploaded

  try {
    // Get current profile data to avoid losing information
    const [currentUserData] = await db.query(
      'SELECT name FROM users WHERE id = ?',
      [scoutId]
    );

    const [currentProfileData] = await db.query(
      'SELECT organization, phone, profile_image, public_id FROM scout_profiles WHERE user_id = ?',
      [scoutId]
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
          folder: 'pharaohs/scout_profiles',
          public_id: `scout_profile_${scoutId}_${Date.now()}`,
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
        INSERT INTO scout_profiles (user_id, profile_image, public_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE profile_image = ?, public_id = ?
      `, [scoutId, cloudinaryResult.secure_url, cloudinaryResult.public_id, cloudinaryResult.secure_url, cloudinaryResult.public_id]);

      return res.json({
        message: 'Profile image updated successfully',
        profileImage: cloudinaryResult.secure_url
      });
    }

    // For regular updates, update the user's name if provided
    if (name) {
      await db.query(
        'UPDATE users SET name = ? WHERE id = ?',
        [name, scoutId]
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
          folder: 'pharaohs/scout_profiles',
          public_id: `scout_profile_${scoutId}_${Date.now()}`,
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
    const updatedOrganization = organization !== undefined ? organization : currentProfile.organization || '';
    const updatedPhone = phone !== undefined ? phone : currentProfile.phone || '';

    await db.query(`
      INSERT INTO scout_profiles (user_id, organization, phone, profile_image, public_id)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        organization = ?,
        phone = ?,
        profile_image = COALESCE(?, profile_image),
        public_id = COALESCE(?, public_id)
    `, [
      scoutId, updatedOrganization, updatedPhone, profileImage, publicId,
      updatedOrganization, updatedPhone, profileImage, publicId
    ]);

    // Fetch the updated profile to return it
    const [[updatedScout]] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, s.organization, s.phone, s.profile_image, s.public_id, u.created_at AS createdAt
      FROM users u
      LEFT JOIN scout_profiles s ON u.id = s.user_id
      WHERE u.id = ?
    `, [scoutId]);

    // Optionally, re-fetch shortlists if they are part of the returned profile
    const [shortlists] = await db.query(`
      SELECT
        u.id, u.name, u.email, u.created_at AS createdAt,
        p.position, p.club, p.bio
      FROM shortlists s
      JOIN users u ON s.player_id = u.id
      LEFT JOIN player_profiles p ON u.id = p.user_id
      WHERE s.scout_id = ?
    `, [scoutId]);

    updatedScout.shortlists = shortlists;
    updatedScout.profileImage = updatedScout.profile_image;

    delete updatedScout.profile_image;
    delete updatedScout.public_id;

    res.json({
      message: 'Profile updated successfully',
      scout: updatedScout
    });

  } catch (err) {
    console.error('[Update Scout Profile Error]', err);
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};

// Add new method for deleting scout profile picture
exports.deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch the current profile image path
    const [profile] = await db.query(
      'SELECT profile_image, public_id FROM scout_profiles WHERE user_id = ?',
      [userId]
    );

    if (!profile.length || !profile[0].profile_image) {
      return res.status(404).json({ message: 'No profile image found' });
    }

    // Delete image from Cloudinary if public_id exists
    if (profile[0].public_id) {
      try {
        await cloudinaryService.deleteFile(profile[0].public_id);
        console.log(`Deleted scout profile image from Cloudinary: ${profile[0].public_id}`);
      } catch (cloudinaryError) {
        console.warn('[Delete Cloudinary Image Warning]', cloudinaryError.message);
      }
    } else if (profile[0].profile_image && !profile[0].profile_image.includes('cloudinary')) {
      // If it's still a local file, try to delete it
      try {
        const filePath = path.join(__dirname, '..', '..', profile[0].profile_image.replace(/^\//, ''));
        await fs.unlink(filePath);
        console.log(`Deleted local scout profile image file: ${filePath}`);
      } catch (fileErr) {
        console.warn('[Delete Scout Profile Image File Warning]', fileErr.message);
      }
    }

    // Update the database to remove the reference
    await db.query(
      'UPDATE scout_profiles SET profile_image = NULL, public_id = NULL WHERE user_id = ?',
      [userId]
    );

    res.json({ message: 'Profile picture deleted successfully' });
  } catch (err) {
    console.error('[Delete Scout Profile Picture Error]', err);
    res.status(500).json({ message: 'Failed to delete profile picture' });
  }
};

exports.getPublicScoutProfile = async (req, res) => {
  const scoutId = req.params.scoutId;

  try {
    const [[scout]] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, s.organization, s.profile_image, u.created_at AS createdAt
      FROM users u
      LEFT JOIN scout_profiles s ON u.id = s.user_id
      WHERE u.id = ? AND u.role = 'scout'
    `, [scoutId]);

    if (!scout) return res.status(404).json({ message: 'Scout not found' });

    // Get count of tryouts and invitations for public stats
    const [[tryoutCount]] = await db.query(`
      SELECT COUNT(*) AS count FROM tryouts WHERE scout_id = ?
    `, [scoutId]);

    const [[invitationCount]] = await db.query(`
      SELECT COUNT(*) AS count
      FROM invitations i
      JOIN tryouts t ON i.tryout_id = t.id
      WHERE t.scout_id = ?
    `, [scoutId]);

    // Format the profile image URL
    if (scout.profile_image) {
      scout.profileImage = ensureCloudinaryUrl(scout.profile_image);
    } else {
      scout.profileImage = null;
    }

    // Remove the original profile_image property to avoid duplication
    delete scout.profile_image;

    // Return the scout profile with public stats
    res.json({
      ...scout,
      tryoutCount: tryoutCount ? tryoutCount.count : 0,
      invitationCount: invitationCount ? invitationCount.count : 0
    });
  } catch (err) {
    console.error('[Get Public Scout Profile Error]', err);
    res.status(500).json({ message: 'Failed to load scout profile' });
  }
};

exports.getPublicScoutTryouts = async (req, res) => {
  const scoutId = req.params.scoutId;

  try {
    // Check if scout exists
    const [[scout]] = await db.query(`
      SELECT id FROM users WHERE id = ? AND role = 'scout'
    `, [scoutId]);

    if (!scout) return res.status(404).json({ message: 'Scout not found' });

    // Get all tryouts for this scout, not just upcoming ones
    const [tryouts] = await db.query(`
      SELECT id, name, location, date
      FROM tryouts
      WHERE scout_id = ?
      ORDER BY date DESC
    `, [scoutId]);

    res.json(tryouts);
  } catch (err) {
    console.error('[Get Public Scout Tryouts Error]', err);
    res.status(500).json({ message: 'Failed to load scout tryouts' });
  }
};

