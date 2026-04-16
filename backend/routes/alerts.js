// ================================================
// FuelGO — routes/alerts.js
// Description: Price alert routes + alert checker
// ================================================
const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');
const { sendPush } = require('../utils/firebase');

// GET /api/alerts
router.get('/', authMW(), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, ft.fuel_name, ft.price_per_litre AS current_price
       FROM price_alerts a
       JOIN fuel_types ft ON a.fuel_type_id = ft.fuel_type_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/alerts
router.post('/', authMW(), async (req, res) => {
  try {
    const { fuel_type_id, threshold_price } = req.body;
    if (!fuel_type_id || !threshold_price) return res.status(400).json({ error: 'fuel_type_id and threshold_price required' });
    if (parseFloat(threshold_price) <= 0) return res.status(400).json({ error: 'threshold_price must be positive' });

    const [[count]] = await db.query(
      'SELECT COUNT(*) AS c FROM price_alerts WHERE user_id = ? AND is_active = 1', [req.user.user_id]
    );
    if (count.c >= 5) return res.status(400).json({ error: 'Maximum 5 active alerts allowed' });

    const [r] = await db.query(
      'INSERT INTO price_alerts (user_id, fuel_type_id, threshold_price) VALUES (?,?,?)',
      [req.user.user_id, fuel_type_id, threshold_price]
    );
    const [[alert]] = await db.query(
      `SELECT a.*, ft.fuel_name, ft.price_per_litre AS current_price
       FROM price_alerts a JOIN fuel_types ft ON a.fuel_type_id = ft.fuel_type_id
       WHERE a.alert_id = ?`,
      [r.insertId]
    );
    res.status(201).json(alert);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/alerts/:id
router.delete('/:id', authMW(), async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM price_alerts WHERE alert_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Exported helper: check alerts when fuel price changes ──
async function checkAndSendAlerts(fuelTypeId, newPrice) {
  try {
    const [alerts] = await db.query(
      `SELECT a.alert_id, a.user_id, u.fcm_token, u.full_name, ft.fuel_name
       FROM price_alerts a
       JOIN users u      ON a.user_id      = u.user_id
       JOIN fuel_types ft ON a.fuel_type_id = ft.fuel_type_id
       WHERE a.fuel_type_id = ? AND a.is_active = 1 AND a.threshold_price >= ?`,
      [fuelTypeId, newPrice]
    );
    for (const alert of alerts) {
      sendPush(
        alert.fcm_token,
        `⛽ Price Alert — ${alert.fuel_name}`,
        `${alert.fuel_name} is now M${parseFloat(newPrice).toFixed(2)}/L — your alert threshold was reached!`,
        { type: 'price_alert', fuel_type_id: String(fuelTypeId) }
      );
      await db.query(
        'UPDATE price_alerts SET is_active = 0, last_triggered_at = NOW() WHERE alert_id = ?',
        [alert.alert_id]
      );
    }
  } catch (err) {
    console.error('checkAndSendAlerts error:', err.message);
  }
}

module.exports = router;
module.exports.checkAndSendAlerts = checkAndSendAlerts;
