const multer = require('multer');
const path = require('path');

// Use memory storage instead of disk storage to avoid writing files to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Log the request content type
  console.log(`[Upload Service] Received file upload with Content-Type: ${req.headers['content-type']}`);
  console.log(`[Upload Service] File: ${file.originalname}, mimetype: ${file.mimetype}`);
  
  const allowedTypes = ['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.error(`[Upload Service] Invalid file type: ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only MP4, WebM, JPEG, PNG, JPG, and WebP are allowed.`), false);
  }
};

// Create a multer instance with proper error handling
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB limit for web uploads
    fieldSize: 20 * 1024 * 1024 // 20MB limit for form fields
  }
});

// Add custom multer error handler
upload.handleError = (err, req, res, next) => {
  console.error('[Multer Error]', err);
  
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
  
  next(err);
};

module.exports = upload;