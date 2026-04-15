// ================================================
// FuelGO — sanitize.js
// Description: Input sanitization and user object helpers
// Author: FuelGO Dev
// ================================================
const BLOCKED = /\b(DROP|DELETE|INSERT|UPDATE|EXEC|UNION|SELECT|ALTER|TRUNCATE)\b/i;
function sanitizeStr(val) {
  if (val === undefined || val === null) return val;
  const s = String(val).trim();
  if (BLOCKED.test(s)) throw new Error('Invalid input detected');
  return s;
}
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePassword(pw) {
  if (!pw || pw.length < 8)        return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw))           return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(pw))           return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(pw))   return 'Password must contain at least one special character';
  return null;
}
function isPositiveNumber(val) { const n = parseFloat(val); return !isNaN(n) && n > 0; }
module.exports = { sanitizeStr, sanitizeUser, isValidEmail, validatePassword, isPositiveNumber };
