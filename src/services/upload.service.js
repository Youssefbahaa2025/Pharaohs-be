const multer = require('multer');
const path = require('path');

// Use memory storage instead of disk storage to avoid writing files to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Enhanced logging for debugging
  console.log(`[Upload Service] Request headers:`, JSON.stringify(req.headers));
  console.log(`[Upload Service] Received file upload with Content-Type: ${req.headers['content-type']}`);
  console.log(`[Upload Service] File: ${file.originalname}, mimetype: ${file.mimetype}, size: ${file.size} bytes`);
  
  // Expanded list of allowed video types
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 
    // Videos
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 
    'video/x-ms-wmv', 'video/mpeg', 'video/3gpp'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.error(`[Upload Service] Invalid file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only supported image and video formats are allowed.`), false);
  }
};

// Create a multer instance with proper error handling
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 100 * 1024 * 1024, // Increased to 100MB limit for video uploads
    fieldSize: 100 * 1024 * 1024 // 100MB limit for form fields
  }
});

// Add custom multer error handler
upload.handleError = (err, req, res, next) => {
  console.error('[Multer Error]', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'File size too large. Maximum allowed size is 100MB.',
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