// ================================================
// FuelGO — routes/ratings.js
// Description: Station ratings/reviews
// ================================================
const router = require('express').Router({ mergeParams: true });
const db     = require('../db');
const authMW = require('../middleware/auth');
const cache  = require('../utils/cache');

// GET /api/stations/:id/ratings
router.get('/', authMW(), async (req, res) => {
  try {
    const sid = req.params.id;

    const [[agg]] = await db.query(
      'SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM station_ratings WHERE station_id = ?',
      [sid]
    );

    const [[own]] = await db.query(
      'SELECT rating, comment FROM station_ratings WHERE station_id = ? AND user_id = ?',
      [sid, req.user.user_id]
    );

    const [reviews] = await db.query(
      `SELECT sr.rating, sr.comment, sr.created_at, u.full_name AS user_name
       FROM station_ratings sr JOIN users u ON sr.user_id = u.user_id
       WHERE sr.station_id = ?
       ORDER BY sr.created_at DESC LIMIT 20`,
      [sid]
    );

    res.json({
      avg_rating:  agg.avg_rating ? parseFloat(agg.avg_rating).toFixed(1) : null,
      count:       agg.count,
      user_rating: own || null,
      reviews,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/stations/:id/ratings
router.post('/', authMW(), async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const sid = req.params.id;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1–5' });

    await db.query(
      `INSERT INTO station_ratings (user_id, station_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = NOW()`,
      [req.user.user_id, sid, rating, comment || null]
    );

    // Invalidate station cache
    cache.invalidate(`station:${sid}`);

    const [[agg]] = await db.query(
      'SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM station_ratings WHERE station_id = ?',
      [sid]
    );
    res.json({ success: true, avg_rating: parseFloat(agg.avg_rating).toFixed(1), count: agg.count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
