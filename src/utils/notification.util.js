const notificationController = require('../controllers/notification.controller');

/**
 * Utility function to create notifications for various events
 */
const NotificationUtil = {
  /**
   * Create a notification for a new invitation
   * @param {number} userId - The user ID to send the notification to
   * @param {string} scoutName - The name of the scout who sent the invitation
   * @param {string} tryoutName - The name of the tryout
   * @returns {Promise<boolean>} - Whether the notification was created successfully
   */
  async createInvitationNotification(userId, scoutName, tryoutName) {
    const message = `You have received a new invitation from ${scoutName} for the tryout: ${tryoutName}`;
    return await notificationController.createNotification(userId, message);
  },

  /**
   * Create a notification for a new comment on a video
   * @param {number} userId - The user ID to send the notification to
   * @param {string} commenterName - The name of the user who commented
   * @param {string} videoTitle - The title or description of the video
   * @returns {Promise<boolean>} - Whether the notification was created successfully
   */
  async createCommentNotification(userId, commenterName, videoTitle) {
    const message = `${commenterName} commented on your video: ${videoTitle || 'Untitled'}`;
    return await notificationController.createNotification(userId, message);
  },

  /**
   * Create a notification for a new like on a video
   * @param {number} userId - The user ID to send the notification to
   * @param {string} likerName - The name of the user who liked
   * @param {string} videoTitle - The title or description of the video
   * @returns {Promise<boolean>} - Whether the notification was created successfully
   */
  async createLikeNotification(userId, likerName, videoTitle) {
    const message = `${likerName} liked your video: ${videoTitle || 'Untitled'}`;
    return await notificationController.createNotification(userId, message);
  },

  /**
   * Create a notification for a new shortlist addition
   * @param {number} userId - The user ID to send the notification to
   * @param {string} scoutName - The name of the scout who added the player
   * @param {string} clubName - The name of the club
   * @returns {Promise<boolean>} - Whether the notification was created successfully
   */
  async createShortlistNotification(userId, scoutName, clubName) {
    const message = `${scoutName} from ${clubName} has added you to their shortlist`;
    return await notificationController.createNotification(userId, message);
  },

  /**
   * Create a notification for a tryout status change
   * @param {number} userId - The user ID to send the notification to
   * @param {string} tryoutName - The name of the tryout
   * @param {string} status - The new status
   * @returns {Promise<boolean>} - Whether the notification was created successfully
   */
  async createTryoutStatusNotification(userId, tryoutName, status) {
    const message = `Your tryout status for ${tryoutName} has been updated to: ${status}`;
    return await notificationController.createNotification(userId, message);
  },

  /**
   * Create a custom notification
   * @param {number} userId - The user ID to send the notification to
   * @param {string} message - The notification message
   * @returns {Promise<boolean>} - Whether the notification was created successfully
   */
  async createCustomNotification(userId, message) {
    return await notificationController.createNotification(userId, message);
  }
};

module.exports = NotificationUtil;
