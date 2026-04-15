const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');

// GET /api/employee/dashboard
router.get('/dashboard', authMW(['employee','admin']), async (req, res) => {
  try {
    const sid   = req.user.station_id;
    const today = new Date().toISOString().slice(0,10);

    const [[station]] = await db.query('SELECT * FROM stations WHERE station_id = ?', [sid]);

    const [[stats]] = await db.query(
      `SELECT COUNT(*) txns, COALESCE(SUM(total_amount),0) revenue, COALESCE(SUM(litres),0) litres
       FROM transactions WHERE station_id=? AND DATE(transaction_date)=?`, [sid, today]);

    const [pumps] = await db.query(
      `SELECT p.*, ft.fuel_name, ft.price_per_litre
       FROM pumps p JOIN fuel_types ft ON p.fuel_type_id = ft.fuel_type_id
       WHERE p.station_id = ? ORDER BY p.pump_number`, [sid]);

    const [recent] = await db.query(
      `SELECT t.*, v.plate_number, v.make, v.model vehicle_model,
              ft.fuel_name, u.full_name customer_name
       FROM transactions t
       LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
       JOIN fuel_types ft ON t.fuel_type_id = ft.fuel_type_id
       JOIN users u ON t.user_id = u.user_id
       WHERE t.station_id = ? ORDER BY t.transaction_date DESC LIMIT 30`, [sid]);

    // 7-day chart data
    const [chart] = await db.query(
      `SELECT DATE(transaction_date) date, SUM(total_amount) revenue, COUNT(*) txns
       FROM transactions WHERE station_id=? AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(transaction_date) ORDER BY date`, [sid]);

    res.json({ station, today: stats, pumps, recent_transactions: recent, chart });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/employee/pumps/:id/status
// Uses atomic UPDATE WHERE status=current to prevent race conditions.
// On success emits a Socket.io event so employee dashboards update in real time.
router.put('/pumps/:id/status', authMW(['employee','admin','customer']), async (req, res) => {
  try {
    const { status, from_status } = req.body;
    const allowed = ['available','in_use','maintenance'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    // Ensure pump belongs to the employee's assigned station (skip for customers releasing their own pump)
    const [[pump]] = await db.query(
      'SELECT pump_id, station_id, status, pump_number FROM pumps WHERE pump_id = ?',
      [req.params.id]
    );
    if (!pump) return res.status(404).json({ error: 'Pump not found' });
    if (req.user.role === 'employee' && pump.station_id !== req.user.station_id)
      return res.status(403).json({ error: 'Access denied — pump is not at your station' });

    // Atomic claim: if a from_status is supplied, only update if the pump is currently in that state.
    // This prevents two users from grabbing the same 'available' pump simultaneously.
    let result;
    if (from_status) {
      [result] = await db.query(
        'UPDATE pumps SET status=? WHERE pump_id=? AND status=?',
        [status, req.params.id, from_status]
      );
      if (result.affectedRows === 0) {
        // Pump was already taken (or status changed) — return conflict
        const [[fresh]] = await db.query('SELECT status FROM pumps WHERE pump_id = ?', [req.params.id]);
        return res.status(409).json({ error: 'Pump status changed', current_status: fresh?.status });
      }
    } else {
      await db.query('UPDATE pumps SET status=? WHERE pump_id=?', [status, req.params.id]);
    }

    // Emit real-time update to all employee dashboards subscribed to this station's room
    const io = req.app.get('io');
    if (io) {
      io.to(`station_${pump.station_id}`).emit('pump_status', {
        pump_id: pump.pump_id,
        pump_number: pump.pump_number,
        status,
      });
    }

    res.json({ success: true, pump_id: pump.pump_id, status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
