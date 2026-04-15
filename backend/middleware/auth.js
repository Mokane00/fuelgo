const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'fuelgo_secret';
const REFRESH_THRESHOLD = 30 * 60; // seconds — refresh if < 30 min left

/**
 * Auth middleware — pass allowed roles array or empty for any authenticated user.
 * Automatically issues X-Refreshed-Token header when token is within 30 min of expiry.
 */
module.exports = (roles = []) => (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    if (roles.length > 0 && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.user = decoded;

    // Proactively refresh token when within 30 minutes of expiry
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && (decoded.exp - now) < REFRESH_THRESHOLD) {
      const { iat, exp, ...payload } = decoded;
      const newToken = jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
      res.setHeader('X-Refreshed-Token', newToken);
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
