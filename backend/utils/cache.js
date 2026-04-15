// ================================================
// FuelGO — cache.js
// Description: Simple in-memory cache with TTL
// Author: FuelGO Dev
// ================================================
const store = {};
function get(key) {
  const e = store[key];
  if (!e) return null;
  if (Date.now() > e.expiresAt) { delete store[key]; return null; }
  return e.value;
}
function set(key, value, ttlSeconds = 60) {
  store[key] = { value, expiresAt: Date.now() + ttlSeconds * 1000 };
}
function invalidate(key) { delete store[key]; }
function invalidatePrefix(prefix) {
  Object.keys(store).forEach(k => { if (k.startsWith(prefix)) delete store[k]; });
}
module.exports = { get, set, invalidate, invalidatePrefix };
