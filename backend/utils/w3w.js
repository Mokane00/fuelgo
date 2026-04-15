// ================================================
// FuelGO — utils/w3w.js
// Description: What3Words — convert lat/lng to 3-word address
// Env vars needed:
//   W3W_API_KEY
// ================================================

// In-memory cache: "lat,lng" → "word.word.word"
const _cache = new Map();

/**
 * Convert coordinates to a What3Words address.
 * @param {number} lat
 * @param {number} lng
 * @returns {string|null}  e.g. "filled.count.soap" or null on error
 */
async function toW3W(lat, lng) {
  const key = process.env.W3W_API_KEY;
  if (!key) return null;

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  try {
    const url = `https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&language=en&key=${key}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    const words = d.words || null;
    if (words) _cache.set(cacheKey, words);
    return words;
  } catch { return null; }
}

/**
 * Convert a 3-word address back to coordinates.
 * @param {string} words  e.g. "filled.count.soap"
 * @returns {{ lat, lng }|null}
 */
async function fromW3W(words) {
  const key = process.env.W3W_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(words)}&key=${key}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    return d.coordinates ? { lat: d.coordinates.lat, lng: d.coordinates.lng } : null;
  } catch { return null; }
}

module.exports = { toW3W, fromW3W };
