const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Check if Cloudinary is properly configured
const isConfigured = () => {
  return (
    process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET
  );
};

// Log Cloudinary config status without exposing sensitive details
console.log(`[Cloudinary] Configuration status: ${isConfigured() ? 'OK' : 'MISSING'}`);

// Export direct functions instead of creating a module object
// This allows direct imports like: const { uploadBuffer } = require('./cloudinary.service');

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - The file buffer to upload
 * @param {string} filename - Original filename for reference
 * @param {string} mimetype - The MIME type of the file 
 * @param {Object} uploadOptions - Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary upload response
 */
exports.uploadBuffer = async (buffer, filename, mimetype, uploadOptions = {}) => {
  try {
    // Check if Cloudinary is configured
    if (!isConfigured()) {
      throw new Error('Cloudinary credentials not configured');
    }

    // Validate buffer exists and has content
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file buffer received');
    }
    
    // Check if this is a video or image
    const isVideo = mimetype.startsWith('video/');
    const isImage = mimetype.startsWith('image/');
    
    // Log upload attempt (without sensitive info)
    console.log(`[Cloudinary] Uploading ${mimetype} file: ${filename}`);
    console.log(`[Cloudinary] Buffer size: ${(buffer.length/1024).toFixed(2)}KB`);
    console.log(`[Cloudinary] Upload options: ${JSON.stringify({
      resource_type: uploadOptions.resource_type || 'auto',
      folder: uploadOptions.folder || 'pharaohs'
    })}`);
    
    // Set timeout options for large uploads (especially videos)
    let options = { ...uploadOptions };
    
    // If it's a video, use enhanced options
    if (isVideo) {
      // Use chunked uploads for videos
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      options = {
        ...options,
        chunk_size: chunkSize,
        timeout: 300000, // 5 minutes timeout for videos
      };
      
      console.log('[Cloudinary] Using video-specific options: chunked upload');
    }
    
    // Convert buffer to base64 string for Cloudinary upload
    const base64String = `data:${mimetype};base64,${buffer.toString('base64')}`;
    
    // Upload to cloudinary
    console.log(`[Cloudinary] Starting upload (${isVideo ? 'video' : 'image'})`);
    const startTime = Date.now();
    const result = await cloudinary.uploader.upload(base64String, options);
    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Log success (without showing full URLs)
    console.log(`[Cloudinary] Upload successful: ${result.public_id}`);
    console.log(`[Cloudinary] Upload took: ${uploadTime} seconds`);
    console.log(`[Cloudinary] Resource type: ${result.resource_type}`);
    console.log(`[Cloudinary] Format: ${result.format}`);
    console.log(`[Cloudinary] Size: ${(result.bytes/1024).toFixed(2)}KB`);
    
    return result;
  } catch (error) {
    // Enhanced error logging
    console.error(`[Cloudinary] Upload failed for ${filename || 'unknown file'}`);
    console.error(`[Cloudinary] Error type: ${error.name}`);
    console.error(`[Cloudinary] Error message: ${error.message}`);
    
    // If it's a Cloudinary API error, log more details
    if (error.http_code) {
      console.error(`[Cloudinary] HTTP code: ${error.http_code}`);
      console.error(`[Cloudinary] Error code: ${error.error?.code || 'unknown'}`);
    }
    
    // Rethrow with better context
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Delete a file from Cloudinary using its public_id
 * @param {string} publicId - The public_id of the file to delete
 * @param {string} resourceType - Resource type (image, video, etc.)
 * @returns {Promise<Object>} Cloudinary deletion response
 */
exports.deleteResource = async (publicId, resourceType = 'image') => {
  try {
    if (!isConfigured()) {
      throw new Error('Cloudinary credentials not configured');
    }
    
    if (!publicId) {
      throw new Error('No public_id provided for deletion');
    }
    
    console.log(`[Cloudinary] Attempting to delete ${resourceType}: ${publicId}`);
    
    const result = await cloudinary.uploader.destroy(publicId, { 
      resource_type: resourceType 
    });
    
    console.log(`[Cloudinary] Delete result for ${publicId}: ${result.result}`);
    return result;
  } catch (error) {
    console.error(`[Cloudinary] Delete failed for ${publicId}`);
    console.error(`[Cloudinary] Error: ${error.message}`);
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

/**
 * Get a Cloudinary URL for a given public_id
 * @param {string} publicId - The public_id of the resource
 * @param {Object} options - URL generation options 
 * @returns {string} The generated Cloudinary URL
 */
exports.getUrl = (publicId, options = {}) => {
  if (!publicId) return null;
  
  const defaultOptions = {
    secure: true,
    quality: 'auto',
    fetch_format: 'auto'
  };
  
  const urlOptions = { ...defaultOptions, ...options };
  return cloudinary.url(publicId, urlOptions);
};

// Export the cloudinary instance
exports.cloudinary = cloudinary;