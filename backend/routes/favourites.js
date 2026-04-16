// ================================================
// FuelGO — routes/favourites.js
// Description: User favourite stations
// ================================================
const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');

// GET /api/favourites
router.get('/', authMW(), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT f.fav_id, f.station_id, f.label, f.created_at,
         s.station_name, s.district, s.location, s.status, s.opening_hours, s.latitude, s.longitude,
         ft.fuel_name, ft.price_per_litre
       FROM user_favourites f
       JOIN stations s ON f.station_id = s.station_id
       LEFT JOIN pumps p ON p.station_id = s.station_id
       LEFT JOIN fuel_types ft ON p.fuel_type_id = ft.fuel_type_id AND ft.fuel_name = 'Petrol'
       WHERE f.user_id = ?
       GROUP BY f.fav_id
       ORDER BY f.created_at DESC`,
      [req.user.user_id]
    );

    // Compute is_open for each station
    const now = new Date();
    const hhmm = now.getHours() * 60 + now.getMinutes();
    const enriched = rows.map(r => {
      let is_open = r.status === 'active';
      if (is_open && r.opening_hours) {
        const m = r.opening_hours.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
        if (m) {
          const open  = parseInt(m[1]) * 60 + parseInt(m[2]);
          const close = parseInt(m[3]) * 60 + parseInt(m[4]);
          is_open = hhmm >= open && hhmm < close;
        }
      }
      return { ...r, is_open };
    });

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/favourites
router.post('/', authMW(), async (req, res) => {
  try {
    const { station_id, label } = req.body;
    if (!station_id) return res.status(400).json({ error: 'station_id required' });
    const validLabels = ['home', 'work', 'other'];
    const lbl = validLabels.includes(label) ? label : 'other';

    await db.query(
      `INSERT INTO user_favourites (user_id, station_id, label)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label)`,
      [req.user.user_id, station_id, lbl]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/favourites/:sid  (by station_id, not fav_id)
router.delete('/:sid', authMW(), async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM user_favourites WHERE user_id = ? AND station_id = ?',
      [req.user.user_id, req.params.sid]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Favourite not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
