const db = require('../config/db');
const cloudinaryService = require('../services/cloudinary.service');

// Helper function to log admin actions
const logAdminAction = async (userId, action, entityType, entityId, details, ipAddress) => {
  try {
    await db.query(
      'INSERT INTO system_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, details, ipAddress]
    );
    return true;
  } catch (err) {
    return false;
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, email, role, status, created_at FROM users ORDER BY id DESC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load users' });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = req.params.id;

  try {
    // Get user details before deletion for logging
    const [userDetails] = await db.query('SELECT name, email FROM users WHERE id = ?', [userId]);

    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    // Log the action
    await logAdminAction(
      req.user.id,
      'DELETE',
      'user',
      userId,
      JSON.stringify(userDetails[0]),
      req.ip
    );

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete user' });
  }
};

exports.updateUserStatus = async (req, res) => {
  const userId = req.params.id;
  const { status } = req.body;

  if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);

    // Log the action
    await logAdminAction(
      req.user.id,
      'UPDATE',
      'user',
      userId,
      `Changed status to ${status}`,
      req.ip
    );

    res.json({ message: 'User status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update user status' });
  }
};

exports.resetUserPassword = async (req, res) => {
  const userId = req.params.id;
  const bcrypt = require('bcryptjs');

  try {
    // Generate a random password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    // Log the action
    await logAdminAction(
      req.user.id,
      'RESET_PASSWORD',
      'user',
      userId,
      'Password reset by admin',
      req.ip
    );

    res.json({ message: 'Password reset', tempPassword });
  } catch (err) {
    res.status(500).json({ message: 'Could not reset password' });
  }
};

exports.getAllVideos = async (req, res) => {
  try {
    const [videos] = await db.query(`
      SELECT v.id, v.url, v.description, v.created_at, v.player_id AS playerId, u.name AS player_name,
             v.status, v.public_id, v.type
      FROM videos v
      JOIN users u ON v.player_id = u.id
      ORDER BY v.created_at DESC
    `);
    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch media' });
  }
};

exports.deleteVideo = async (req, res) => {
  const videoId = req.params.id;

  try {
    // Get video details before deletion for logging
    const [videoDetails] = await db.query('SELECT description, player_id, url, public_id, type FROM videos WHERE id = ?', [videoId]);
    
    if (videoDetails.length === 0) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Delete from Cloudinary if public_id exists
    if (videoDetails[0].public_id) {
      try {
        await cloudinaryService.deleteFile(videoDetails[0].public_id, {
          resource_type: videoDetails[0].type === 'image' ? 'image' : 'video'
        });
      } catch (err) {
        console.warn('[Delete from Cloudinary Warning]', err.message);
      }
    }

    await db.query('DELETE FROM videos WHERE id = ?', [videoId]);

    // Log the action
    await logAdminAction(
      req.user.id,
      'DELETE',
      'video',
      videoId,
      JSON.stringify(videoDetails[0]),
      req.ip
    );

    res.json({ message: 'Video deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete video' });
  }
};

exports.updateVideoStatus = async (req, res) => {
  const videoId = req.params.id;
  const { status } = req.body;

  if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    await db.query('UPDATE videos SET status = ? WHERE id = ?', [status, videoId]);

    // Log the action
    await logAdminAction(
      req.user.id,
      'UPDATE',
      'video',
      videoId,
      `Changed status to ${status}`,
      req.ip
    );

    res.json({ message: 'Video status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update video status' });
  }
};

exports.getTryoutLocations = async (req, res) => {
  try {
    const [locations] = await db.query(`
      SELECT DISTINCT location
      FROM tryouts
      WHERE location IS NOT NULL AND location != ''
      ORDER BY location
    `);

    res.json(locations.map(l => l.location));
  } catch (err) {
    console.error('[Get Tryout Locations Error]', err);
    res.status(500).json({ message: 'Failed to load tryout locations' });
  }
};

exports.addTryoutLocation = async (req, res) => {
  const { location } = req.body;

  if (!location || location.trim() === '') {
    return res.status(400).json({ message: 'Location name is required' });
  }

  try {
    // Check if location already exists
    const [existingLocations] = await db.query(
      'SELECT location FROM tryouts WHERE location = ? LIMIT 1',
      [location]
    );

    if (existingLocations.length > 0) {
      return res.status(400).json({ message: 'Location already exists' });
    }

    // Create a dummy tryout with this location
    // We use a special name 'Location Template' to identify these records
    await db.query(
      'INSERT INTO tryouts (scout_id, name, location, date) VALUES (?, ?, ?, ?)',
      [req.user.id, 'Location Template', location, new Date()]
    );

    // Log the action
    await logAdminAction(
      req.user.id,
      'CREATE',
      'location',
      null,
      `Added new location: ${location}`,
      req.ip
    );

    res.status(201).json({ message: 'Location added successfully', location });
  } catch (err) {
    console.error('[Add Tryout Location Error]', err);
    res.status(500).json({ message: 'Failed to add location' });
  }
};

exports.deleteTryoutLocation = async (req, res) => {
  const { location } = req.params;

  if (!location) {
    return res.status(400).json({ message: 'Location name is required' });
  }

  try {
    // Check if location is in use by any active tryouts that are not templates
    const [activeTryouts] = await db.query(
      'SELECT COUNT(*) as count FROM tryouts WHERE location = ? AND name != ?',
      [location, 'Location Template']
    );

    if (activeTryouts[0].count > 0) {
      return res.status(400).json({
        message: 'Cannot delete location that is in use by active tryouts',
        count: activeTryouts[0].count
      });
    }

    // Delete the dummy tryout with this location
    await db.query(
      'DELETE FROM tryouts WHERE location = ? AND name = ?',
      [location, 'Location Template']
    );

    // Log the action
    await logAdminAction(
      req.user.id,
      'DELETE',
      'location',
      null,
      `Deleted location: ${location}`,
      req.ip
    );

    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    console.error('[Delete Tryout Location Error]', err);
    res.status(500).json({ message: 'Failed to delete location' });
  }
};

exports.getSystemLogs = async (req, res) => {
  try {
    const { startDate, endDate, action, entityType, userId, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT l.*, u.name as user_name
      FROM system_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      query += ' AND l.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND l.created_at <= ?';
      params.push(endDate);
    }

    if (action) {
      query += ' AND l.action = ?';
      params.push(action);
    }

    if (entityType) {
      query += ' AND l.entity_type = ?';
      params.push(entityType);
    }

    if (userId) {
      query += ' AND l.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await db.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM system_logs l
      WHERE 1=1
    `;

    const countParams = [];

    if (startDate) {
      countQuery += ' AND l.created_at >= ?';
      countParams.push(startDate);
    }

    if (endDate) {
      countQuery += ' AND l.created_at <= ?';
      countParams.push(endDate);
    }

    if (action) {
      countQuery += ' AND l.action = ?';
      countParams.push(action);
    }

    if (entityType) {
      countQuery += ' AND l.entity_type = ?';
      countParams.push(entityType);
    }

    if (userId) {
      countQuery += ' AND l.user_id = ?';
      countParams.push(userId);
    }

    const [totalCount] = await db.query(countQuery, countParams);

    res.json({
      logs,
      pagination: {
        total: totalCount[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch system logs' });
  }
};
