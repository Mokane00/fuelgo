// ================================================
// FuelGO — routes/push.js
// Description: FCM push notification subscription + send
// ================================================
const router = require('express').Router();
const authMW = require('../middleware/auth');
const db     = require('../db');
const { sendPush } = require('../utils/firebase');

/**
 * POST /api/push/subscribe
 * Save (or update) the user's FCM registration token.
 * Body: { token }
 */
router.post('/subscribe', authMW(), async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  await db.query('UPDATE users SET fcm_token = ? WHERE user_id = ?', [token, req.user.user_id]);
  res.json({ success: true });
});

/**
 * POST /api/push/send  (admin only — manual blast)
 * Body: { user_id?, title, body, data? }
 */
router.post('/send', authMW('admin'), async (req, res) => {
  const { user_id, title, body, data } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  if (user_id) {
    const [[u]] = await db.query('SELECT fcm_token FROM users WHERE user_id = ?', [user_id]);
    await sendPush(u?.fcm_token, title, body, data);
  } else {
    const [rows] = await db.query('SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL');
    await Promise.all(rows.map(r => sendPush(r.fcm_token, title, body, data)));
  }

  res.json({ success: true });
});

module.exports = router;
