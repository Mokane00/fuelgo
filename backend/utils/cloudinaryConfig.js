// ================================================
// FuelGO — utils/cloudinaryConfig.js
// Description: Cloudinary configuration + multer upload
// ================================================
const cloudinary = require('cloudinary').v2;
const multer     = require('multer');
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage — we pipe the buffer directly to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Upload a buffer to Cloudinary
 * @returns {Promise<{url, public_id}>}
 */
function uploadToCloudinary(buffer, folder = 'fuelgo/avatars') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }] },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

module.exports = { upload, uploadToCloudinary };
