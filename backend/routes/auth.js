// ================================================
// FuelGO — routes/auth.js
// Description: Authentication routes (login, register, profile, Google OAuth)
// Author: FuelGO Dev
// ================================================
const router   = require('express').Router();
const db       = require('../db');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authMW   = require('../middleware/auth');
const { sanitizeUser, isValidEmail, validatePassword } = require('../utils/sanitize');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');

// In-memory OTP store: email -> { code, expires, name }
const otpStore = new Map();

const SECRET  = process.env.JWT_SECRET   || 'fuelgo_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

function makeToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role,
      full_name: user.full_name, station_id: user.station_id || null },
    SECRET, { expiresIn: EXPIRES }
  );
}

function buildUserResponse(user) {
  const nameParts = (user.full_name || '').split(' ');
  return {
    user_id:    user.user_id,
    full_name:  user.full_name,
    first_name: nameParts[0] || '',
    last_name:  nameParts.slice(1).join(' ') || '',
    email:      user.email,
    role:       user.role,
    station_id: user.station_id,
    phone:      user.phone,
    avatar_url: user.avatar_url || null,
  };
}

// ── POST /api/auth/login ─────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });

    const [[user]] = await db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ token: makeToken(user), user: buildUserResponse(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/auth/register ──────────────────────
router.post('/register', async (req, res) => {
  try {
    const full_name = req.body.full_name ||
      `${req.body.first_name || ''} ${req.body.last_name || ''}`.trim();
    const { email, phone, password } = req.body;

    if (!full_name) return res.status(400).json({ error: 'Name is required' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Valid email is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const [[existing]] = await db.query('SELECT user_id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, "customer")',
      [full_name, email.toLowerCase().trim(), phone || null, hash]
    );
    const userId = result.insertId;
    await db.query("INSERT INTO loyalty (user_id, points_balance, tier, total_spent) VALUES (?, 0, 'Bronze', 0)", [userId]);

    const [[newUser]] = await db.query('SELECT * FROM users WHERE user_id = ?', [userId]);

    // Send welcome email (non-blocking)
    if (process.env.SMTP_USER && process.env.SMTP_USER !== 'your_gmail@gmail.com') {
      sendWelcomeEmail(email, { userName: full_name }).catch(e => console.error('Welcome email error:', e.message));
    }

    res.status(201).json({ token: makeToken(newUser), user: buildUserResponse(newUser) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/auth/me ─────────────────────────────
router.get('/me', authMW(), async (req, res) => {
  try {
    const [[user]] = await db.query(
      'SELECT user_id, full_name, email, phone, role, station_id, avatar_url, google_id, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(buildUserResponse(user));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/auth/profile ────────────────────────
router.put('/profile', authMW(), async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    await db.query('UPDATE users SET full_name=?, phone=? WHERE user_id=?',
      [full_name, phone, req.user.user_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/auth/password ───────────────────────
router.put('/password', authMW(), async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both current and new password required' });

    const pwError = validatePassword(new_password);
    if (pwError) return res.status(400).json({ error: pwError });

    const [[user]] = await db.query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, req.user.user_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/auth/forgot-password ──────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });

    const [[user]] = await db.query('SELECT user_id, full_name, email FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    // Always return success to prevent email enumeration
    if (!user) return res.json({ success: true });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(email.toLowerCase().trim(), { code, expires: Date.now() + 15 * 60 * 1000, name: user.full_name });

    // Send reset code via email
    const emailConfigured = process.env.SMTP_USER && process.env.SMTP_USER !== 'your_gmail@gmail.com';
    if (emailConfigured) {
      sendPasswordResetEmail(email, { userName: user.full_name, code }).catch(e => console.error('Reset email error:', e.message));
    } else {
      console.log(`[DEV] Password reset code for ${email}: ${code}`);
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/auth/reset-password ───────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) return res.status(400).json({ error: 'Email, code, and new password are required' });

    const pwError = validatePassword(new_password);
    if (pwError) return res.status(400).json({ error: pwError });

    const key = email.toLowerCase().trim();
    const entry = otpStore.get(key);
    if (!entry) return res.status(400).json({ error: 'No reset code found. Please request a new one.' });
    if (Date.now() > entry.expires) { otpStore.delete(key); return res.status(400).json({ error: 'Code has expired. Please request a new one.' }); }
    if (entry.code !== String(code).trim()) return res.status(400).json({ error: 'Invalid code. Please check and try again.' });

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, key]);
    otpStore.delete(key);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Google OAuth2 ────────────────────────────────
passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email      = profile.emails?.[0]?.value?.toLowerCase();
    const googleId   = profile.id;
    const displayName = profile.displayName || '';
    const avatar     = profile.photos?.[0]?.value || null;

    if (!email) return done(new Error('Google account has no email'));

    // Find existing user by google_id or email
    let [[user]] = await db.query('SELECT * FROM users WHERE google_id = ? OR email = ?', [googleId, email]);

    if (user) {
      // Link google_id if not yet linked
      if (!user.google_id) {
        await db.query('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE user_id = ?',
          [googleId, avatar, user.user_id]);
      }
    } else {
      // Create new user
      const [result] = await db.query(
        'INSERT INTO users (full_name, email, password_hash, role, google_id, avatar_url) VALUES (?, ?, ?, "customer", ?, ?)',
        [displayName, email, await bcrypt.hash(Math.random().toString(36), 8), googleId, avatar]
      );
      await db.query("INSERT INTO loyalty (user_id, points_balance, tier, total_spent) VALUES (?, 0, 'Bronze', 0)", [result.insertId]);
      [[user]] = await db.query('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.user_id));
passport.deserializeUser(async (id, done) => {
  try {
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ?', [id]);
    done(null, user);
  } catch (err) { done(err); }
});

// GET /api/auth/google — start OAuth flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// GET /api/auth/google/callback — handle callback
const FE_URL = process.env.FRONTEND_URL || 'http://localhost:5000';
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FE_URL}/index.html?error=oauth_failed` }),
  (req, res) => {
    const token = makeToken(req.user);
    const user  = JSON.stringify(buildUserResponse(req.user));
    const encoded = encodeURIComponent(user);
    res.redirect(`${FE_URL}/index.html?token=${token}&user=${encoded}`);
  }
);

module.exports = router;
