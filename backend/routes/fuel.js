// ================================================
// FuelGO — routes/fuel.js
// Description: Fuel type routes with response caching
// Author: FuelGO Dev
// ================================================
const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');
const cache  = require('../utils/cache');

// ── GET /api/fuel-types ──────────────────────────
router.get('/', async (req, res) => {
  try {
    const cached = cache.get('fuel:all');
    if (cached) return res.json(cached);
    const [fuels] = await db.query('SELECT * FROM fuel_types ORDER BY fuel_type_id');
    cache.set('fuel:all', fuels, 300);
    res.json(fuels);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/fuel-types/:id  (admin) ─────────────
router.put('/:id', authMW(['admin']), async (req, res) => {
  try {
    const { price_per_litre } = req.body;
    await db.query('UPDATE fuel_types SET price_per_litre=? WHERE fuel_type_id=?', [price_per_litre, req.params.id]);
    cache.invalidate('fuel:all');
    // Non-blocking alert check
    const { checkAndSendAlerts } = require('./alerts');
    checkAndSendAlerts(req.params.id, price_per_litre);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
