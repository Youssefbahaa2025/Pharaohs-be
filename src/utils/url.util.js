const getFullUrl = (path) => {
  if (!path) return null;
  
  // If already a full URL, return as is
  if (path.startsWith('http')) {
    return path;
  }
  
  // Otherwise, add the API base URL
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

const getApiUrl = () => {
  return process.env.API_URL || 'http://localhost:3000';
};

const getCloudinaryPublicId = (url) => {
  if (!url) return null;
  
  // If it's a Cloudinary URL
  if (url.includes('cloudinary.com')) {
    // Extract the public ID from the URL
    const match = url.match(/\/v\d+\/(.+?)(?:\.\w+)?$/);
    return match ? match[1] : null;
  }
  
  return null;
};

/**
 * Checks if a URL is a Cloudinary URL
 * @param {string} url - URL to check
 * @returns {boolean} - True if the URL is a Cloudinary URL
 */
const isCloudinaryUrl = (url) => {
  if (!url) return false;
  return url.includes('cloudinary.com');
};

/**
 * Ensures a URL is a Cloudinary URL, redirecting local paths if needed
 * @param {string} url - URL to normalize
 * @returns {string} - Cloudinary URL or mapped URL
 */
const ensureCloudinaryUrl = (url) => {
  if (!url) return null;
  
  // If already a Cloudinary URL
  if (isCloudinaryUrl(url)) {
    return url;
  }
  
  // Map local paths to Cloudinary defaults
  if (url.includes('/uploads/images/')) {
    const filename = url.split('/').pop();
    const defaultImages = {
      'player_profile.jpg': 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/profiles/default_profile',
      'player_action.jpg': 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/images/default_action',
      'team_logo.jpg': 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/images/team_logo',
      'stadium_cairo.jpg': 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/images/stadium_cairo'
    };
    return defaultImages[filename] || 'https://res.cloudinary.com/dk0szadna/image/upload/v1/pharaohs/profiles/default_profile';
  }
  
  if (url.includes('/uploads/videos/')) {
    return 'https://res.cloudinary.com/dk0szadna/video/upload/v1/pharaohs/videos/default_video';
  }
  
  return url;
};

module.exports = {
  getFullUrl,
  getApiUrl,
  getCloudinaryPublicId,
  isCloudinaryUrl,
  ensureCloudinaryUrl
}; 