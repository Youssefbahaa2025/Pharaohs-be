const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local path to the file
 * @param {Object} options - Upload options
 * @returns {Promise} - Cloudinary upload response
 */
const uploadFile = async (filePath, options = {}) => {
  // Default options for optimization and folder structure
  const defaults = {
    resource_type: 'auto', // auto-detect whether it's an image or video
    folder: 'pharaohs', // Base folder for all uploads
    use_filename: false,
    unique_filename: true,
    overwrite: true,
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' } // Automatic quality and format optimization
    ]
  };

  // For videos, add options for compression and optimization
  if (options.resource_type === 'video') {
    // Enhanced video compression settings
    defaults.transformation = [
      { 
        quality: 'auto:low', 
        fetch_format: 'mp4',
        video_codec: 'auto',
        audio_codec: 'aac',
        bit_rate: '1500k',  // Lower bitrate for better compression
        fps: '24'           // Reduce frame rate
      }
    ];
    
    // Add video optimization hints
    defaults.eager = [
      // Lower resolution version for mobile
      { 
        width: 640, 
        height: 360, 
        crop: 'limit', 
        fetch_format: 'mp4',
        quality: 'auto:low' 
      }
    ];
  }

  // For images, use appropriate optimization settings
  if (options.resource_type === 'image') {
    defaults.transformation = [
      { 
        width: 1200, 
        crop: 'limit', 
        quality: 'auto:low', 
        fetch_format: 'webp',  // WebP for better compression
        dpr: 'auto'            // Handle device pixel ratio automatically
      }
    ];
    
    // Add eager transformations for common sizes
    defaults.eager = [
      // Thumbnail
      { width: 300, height: 300, crop: 'fill', gravity: 'auto', quality: 'auto:low', fetch_format: 'webp' },
      // Medium size
      { width: 800, crop: 'limit', quality: 'auto:low', fetch_format: 'webp' }
    ];
  }

  // Merge defaults with provided options
  const uploadOptions = { ...defaults, ...options };

  try {
    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    return result;
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    throw error;
  }
};

/**
 * Upload file buffer directly to Cloudinary without saving to disk
 * @param {Buffer} buffer - File buffer
 * @param {String} originalname - Original file name
 * @param {String} mimetype - File mime type
 * @param {Object} options - Upload options
 * @returns {Promise} - Cloudinary upload response
 */
const uploadBuffer = async (buffer, originalname, mimetype, options = {}) => {
  // Default options for optimization and folder structure
  const defaults = {
    resource_type: 'auto', // auto-detect whether it's an image or video
    folder: 'pharaohs', // Base folder for all uploads
    use_filename: false,
    unique_filename: true,
    overwrite: true,
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' } // Automatic quality and format optimization
    ]
  };

  // Determine resource type from mimetype
  const resourceType = mimetype.startsWith('image/') ? 'image' : 'video';
  
  // For videos, add options for compression and optimization
  if (resourceType === 'video') {
    // Enhanced video compression settings
    defaults.transformation = [
      { 
        quality: 'auto:low', 
        fetch_format: 'mp4',
        video_codec: 'auto',
        audio_codec: 'aac',
        bit_rate: '1500k',  // Lower bitrate for better compression
        fps: '24'           // Reduce frame rate
      }
    ];
    
    // Add video optimization hints
    defaults.eager = [
      // Lower resolution version for mobile
      { 
        width: 640, 
        height: 360, 
        crop: 'limit', 
        fetch_format: 'mp4',
        quality: 'auto:low' 
      }
    ];
  }

  // For images, use appropriate optimization settings
  if (resourceType === 'image') {
    defaults.transformation = [
      { 
        width: 1200, 
        crop: 'limit', 
        quality: 'auto:low', 
        fetch_format: 'webp',  // WebP for better compression
        dpr: 'auto'            // Handle device pixel ratio automatically
      }
    ];
    
    // Add eager transformations for common sizes
    defaults.eager = [
      // Thumbnail
      { width: 300, height: 300, crop: 'fill', gravity: 'auto', quality: 'auto:low', fetch_format: 'webp' },
      // Medium size
      { width: 800, crop: 'limit', quality: 'auto:low', fetch_format: 'webp' }
    ];
  }

  // Merge defaults with provided options
  const uploadOptions = { 
    ...defaults, 
    ...options,
    resource_type: options.resource_type || resourceType
  };

  try {
    // Convert buffer to base64 string for Cloudinary upload
    const base64String = `data:${mimetype};base64,${buffer.toString('base64')}`;
    
    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(base64String, uploadOptions);
    return result;
  } catch (error) {
    console.error('Cloudinary buffer upload failed:', error);
    throw error;
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID of the file
 * @param {Object} options - Delete options
 * @returns {Promise} - Cloudinary delete response
 */
const deleteFile = async (publicId, options = {}) => {
  const defaults = {
    resource_type: 'auto',
    invalidate: true
  };

  const deleteOptions = { ...defaults, ...options };

  try {
    const result = await cloudinary.uploader.destroy(publicId, deleteOptions);
    return result;
  } catch (error) {
    console.error('Cloudinary delete failed:', error);
    throw error;
  }
};

/**
 * Generate Cloudinary URL with transformation options
 * @param {string} publicId - Cloudinary public ID of the file
 * @param {Object} options - Transformation options
 * @returns {string} - Transformed Cloudinary URL
 */
const getUrl = (publicId, options = {}) => {
  const defaults = {
    secure: true,
    transformation: [
      { fetch_format: 'auto', quality: 'auto' }
    ]
  };

  const urlOptions = { ...defaults, ...options };
  return cloudinary.url(publicId, urlOptions);
};

module.exports = {
  uploadFile,
  uploadBuffer,
  deleteFile,
  getUrl,
  cloudinary
};