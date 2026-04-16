// ================================================
// FuelGO — routes/stations.js
// Description: Station routes with response caching and real-time open/closed
// Author: FuelGO Dev
// ================================================
const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');
const cache  = require('../utils/cache');
const { toW3W } = require('../utils/w3w');
const { getDrivingDistances, formatDistance, formatDuration } = require('../utils/mapbox');

/**
 * Compute whether a station is currently open based on its opening_hours string.
 * Format: "HH:MM-HH:MM"  e.g. "06:00-22:00"  |  "00:00-23:59" = 24 hrs
 */
function computeIsOpen(openingHours) {
  if (!openingHours) return null;
  try {
    const parts = openingHours.replace(/\s/g, '').split('-');
    if (parts.length < 2) return null;
    const [openStr, closeStr] = parts;
    // 24-hour station
    if (openStr === '00:00' && (closeStr === '23:59' || closeStr === '24:00')) return true;
    // Current Lesotho time (UTC+2 = Africa/Maseru)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Maseru' }));
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = openStr.split(':').map(Number);
    const [ch, cm] = closeStr.split(':').map(Number);
    return cur >= oh * 60 + om && cur < ch * 60 + cm;
  } catch { return null; }
}

// ── GET /api/stations/nearest?lat=&lng= ──────────
// Returns up to 10 stations sorted by driving distance via Mapbox.
// Falls back to straight-line distance when Mapbox is unconfigured.
router.get('/nearest', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  try {
    const [stations] = await db.query(`
      SELECT s.station_id, s.station_name, s.district, s.latitude, s.longitude,
             s.opening_hours, s.status
      FROM stations s WHERE s.status = 'active' AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL`);

    const origin = { lat: parseFloat(lat), lng: parseFloat(lng) };

    const token = process.env.MAPBOX_ACCESS_TOKEN;
    const tokenValid = token && !token.includes('your_mapbox');
    if (tokenValid && stations.length > 0) {
      const dests = stations.map(s => ({ station_id: s.station_id, lat: s.latitude, lng: s.longitude }));
      const distances = await getDrivingDistances(origin, dests);

      // Only use Mapbox results if we actually got some back
      if (distances.length > 0) {
        const distMap = {};
        distances.forEach(d => { distMap[d.station_id] = d; });

        const enriched = stations.map(s => ({
          ...s,
          is_open:        computeIsOpen(s.opening_hours),
          distance_m:     distMap[s.station_id]?.distance_m ?? null,
          duration_s:     distMap[s.station_id]?.duration_s ?? null,
          distance_label: formatDistance(distMap[s.station_id]?.distance_m),
          duration_label: formatDuration(distMap[s.station_id]?.duration_s),
        })).sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity)).slice(0, 10);

        return res.json(enriched);
      }
    }

    // Fallback: straight-line (Haversine)
    function haversine(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const enriched = stations.map(s => {
      const dist = haversine(origin.lat, origin.lng, s.latitude, s.longitude);
      return { ...s, is_open: computeIsOpen(s.opening_hours), distance_m: dist, distance_label: formatDistance(dist), duration_label: '' };
    }).sort((a, b) => a.distance_m - b.distance_m).slice(0, 10);

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/stations ────────────────────────────
router.get('/', async (req, res) => {
  try {
    // is_open is time-dependent so cache only 60 s
    const cached = cache.get('stations:all');
    if (cached) {
      // Recompute is_open on every request (fast, no DB hit)
      const live = cached.map(s => ({ ...s, is_open: computeIsOpen(s.opening_hours) }));
      return res.json(live);
    }
    const [stations] = await db.query(`
      SELECT s.*, COUNT(p.pump_id) pump_count
      FROM stations s LEFT JOIN pumps p ON p.station_id = s.station_id
      GROUP BY s.station_id ORDER BY s.district, s.station_name`);
    // Attach fuel prices to every station (needed for price filter chips on map)
    const [fuels] = await db.query('SELECT * FROM fuel_types ORDER BY fuel_type_id');
    const stationsWithFuels = stations.map(s => ({ ...s, fuel_prices: fuels }));
    // Enrich with W3W addresses in parallel (non-blocking — cached after first call)
    await Promise.all(stationsWithFuels.map(async s => {
      if (s.latitude && s.longitude) {
        s.w3w = await toW3W(s.latitude, s.longitude).catch(() => null);
      }
    }));
    cache.set('stations:all', stationsWithFuels, 60);
    const live = stationsWithFuels.map(s => ({ ...s, is_open: computeIsOpen(s.opening_hours) }));
    res.json(live);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/stations/:id ────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const key = `stations:${req.params.id}`;
    const cached = cache.get(key);
    if (cached) return res.json(cached);

    const [[station]] = await db.query('SELECT * FROM stations WHERE station_id = ?', [req.params.id]);
    if (!station) return res.status(404).json({ error: 'Station not found' });

    const [pumps] = await db.query(
      `SELECT p.*, ft.fuel_name, ft.price_per_litre
       FROM pumps p JOIN fuel_types ft ON p.fuel_type_id = ft.fuel_type_id
       WHERE p.station_id = ? ORDER BY p.pump_number`, [req.params.id]);
    const [fuels] = await db.query('SELECT * FROM fuel_types ORDER BY fuel_type_id');
    station.pumps = pumps;
    station.fuel_prices = fuels;
    station.is_open = computeIsOpen(station.opening_hours);
    // W3W — lazy enrich, cache long-term since coordinates don't change
    if (station.latitude && station.longitude) {
      station.w3w = await toW3W(station.latitude, station.longitude).catch(() => null);
    }
    cache.set(key, station, 60);
    res.json(station);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/stations/:id/pumps ──────────────────
router.get('/:id/pumps', async (req, res) => {
  try {
    const [pumps] = await db.query(
      `SELECT p.*, ft.fuel_name, ft.price_per_litre
       FROM pumps p JOIN fuel_types ft ON p.fuel_type_id = ft.fuel_type_id
       WHERE p.station_id = ? ORDER BY p.pump_number`, [req.params.id]);
    res.json(pumps);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/stations/:id  (admin) ───────────────
router.put('/:id', authMW(['admin']), async (req, res) => {
  try {
    const { station_name, location, district, contact_number, status, opening_hours } = req.body;
    await db.query(
      'UPDATE stations SET station_name=?,location=?,district=?,contact_number=?,status=?,opening_hours=? WHERE station_id=?',
      [station_name, location, district, contact_number, status, opening_hours, req.params.id]
    );
    cache.invalidatePrefix('stations:');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/stations  (admin) ──────────────────
router.post('/', authMW(['admin']), async (req, res) => {
  try {
    const { station_name, location, district, latitude, longitude, contact_number, status, opening_hours } = req.body;
    const [r] = await db.query(
      'INSERT INTO stations (station_name,location,district,latitude,longitude,contact_number,status,opening_hours) VALUES (?,?,?,?,?,?,?,?)',
      [station_name, location, district, latitude, longitude, contact_number, status || 'active', opening_hours]
    );
    cache.invalidatePrefix('stations:');
    res.status(201).json({ station_id: r.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/stations/:id  (admin) ────────────
router.delete('/:id', authMW(['admin']), async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM stations WHERE station_id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Station not found' });
    cache.invalidatePrefix('stations:');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
