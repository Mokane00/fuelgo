// ================================================
// FuelGO — routes/upload.js
// Description: Profile picture upload via Cloudinary
// ================================================
const router  = require('express').Router();
const authMW  = require('../middleware/auth');
const db      = require('../db');
const { upload, uploadToCloudinary } = require('../utils/cloudinaryConfig');

/**
 * POST /api/upload/avatar
 * Uploads a profile picture to Cloudinary and saves URL to users table.
 * Requires: multipart/form-data with field "avatar"
 */
router.post('/avatar', authMW(), upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const { url, public_id } = await uploadToCloudinary(
      req.file.buffer,
      'fuelgo/avatars'
    );

    // Persist URL on the user row (add column if missing)
    await db.query(
      'UPDATE users SET avatar_url = ? WHERE user_id = ?',
      [url, req.user.user_id]
    );

    res.json({ avatar_url: url, public_id });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
