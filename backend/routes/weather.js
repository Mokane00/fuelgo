// ================================================
// FuelGO — routes/weather.js
// Description: OpenWeatherMap + ipapi endpoints
// ================================================
const router = require('express').Router();
const { getWeather, getLocationFromIP } = require('../utils/weather');

/**
 * GET /api/weather?lat=&lng=
 * Returns current weather for given coordinates.
 */
router.get('/', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  const data = await getWeather(parseFloat(lat), parseFloat(lng));
  if (!data) return res.status(503).json({ error: 'Weather service unavailable' });
  res.json(data);
});

/**
 * GET /api/weather/locate
 * Auto-detect approximate location from client IP.
 */
router.get('/locate', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const loc = await getLocationFromIP(ip === '::1' || ip === '127.0.0.1' ? '196.212.0.1' : ip);
  // Fall back to Maseru (capital of Lesotho) so dashboard weather always loads
  res.json(loc || { city: 'Maseru', region: 'Maseru', country: 'Lesotho', latitude: -29.3167, longitude: 27.4833 });
});

module.exports = router;
