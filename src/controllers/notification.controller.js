const db = require('../config/db');

// Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get notifications with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Get total count
    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
      [userId]
    );
    const total = countResult[0].total;
    
    // Get notifications with pagination
    const [notifications] = await db.query(
      `SELECT id, message, is_read, created_at 
       FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    // Get unread count
    const [unreadResult] = await db.query(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    const unreadCount = unreadResult[0].unread;
    
    res.json({
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    // Verify the notification belongs to the user
    const [notification] = await db.query(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    
    if (notification.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Mark as read
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ?',
      [notificationId]
    );
    
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Mark all as read
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [userId]
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    // Verify the notification belongs to the user
    const [notification] = await db.query(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    
    if (notification.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Delete the notification
    await db.query(
      'DELETE FROM notifications WHERE id = ?',
      [notificationId]
    );
    
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete notification' });
  }
};

// Create a notification (for internal use)
exports.createNotification = async (userId, message) => {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, NOW())',
      [userId, message]
    );
    return true;
  } catch (err) {
    return false;
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [result] = await db.query(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    
    res.json({ unreadCount: result[0].unread });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch unread count' });
  }
};
