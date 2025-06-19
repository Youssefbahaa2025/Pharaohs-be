const multer = require('multer');
const path = require('path');

// Use memory storage instead of disk storage to avoid writing files to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP4, WebM, JPEG, PNG, and JPG are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB limit - more reasonable for web uploads
    fieldSize: 20 * 1024 * 1024 // 20MB limit for form fields
  }
});

module.exports = upload;