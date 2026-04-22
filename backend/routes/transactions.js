const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');
const { sendReceiptEmail } = require('../utils/email');
const { calcPoints, calcTier } = require('../utils/pointsCalculator');
const { sendPush } = require('../utils/firebase');
const { getCarbonEstimate } = require('../utils/carbon');

const TXN_SELECT = `
  SELECT t.*,
    s.station_name, s.location AS station_location,
    ft.fuel_name,
    v.plate_number, v.make, v.model AS vehicle_model,
    p.pump_number,
    u.full_name AS customer_name
  FROM transactions t
  JOIN stations s    ON t.station_id    = s.station_id
  JOIN fuel_types ft ON t.fuel_type_id  = ft.fuel_type_id
  LEFT JOIN vehicles v  ON t.vehicle_id  = v.vehicle_id
  LEFT JOIN pumps p     ON t.pump_id     = p.pump_id
  JOIN users u          ON t.user_id     = u.user_id
`;

// GET /api/transactions
router.get('/', authMW(), async (req, res) => {
  try {
    const { role, user_id, station_id } = req.user;
    let rows;
    if (role === 'admin') {
      [rows] = await db.query(`${TXN_SELECT} ORDER BY t.transaction_date DESC LIMIT 1000`);
    } else if (role === 'employee') {
      [rows] = await db.query(`${TXN_SELECT} WHERE t.station_id = ? ORDER BY t.transaction_date DESC LIMIT 300`, [station_id]);
    } else {
      [rows] = await db.query(`${TXN_SELECT} WHERE t.user_id = ? ORDER BY t.transaction_date DESC`, [user_id]);
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/transactions/:id
router.get('/:id', authMW(), async (req, res) => {
  try {
    const [[txn]] = await db.query(`${TXN_SELECT} WHERE t.transaction_id = ?`, [req.params.id]);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (req.user.role === 'customer' && txn.user_id !== req.user.user_id)
      return res.status(403).json({ error: 'Access denied' });
    res.json(txn);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/transactions  — create a fuelling transaction
router.post('/', authMW(), async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const { vehicle_id, pump_id, station_id, fuel_type_id, litres, price_per_litre, total_amount, payment_method } = req.body;

    // Validate vehicle belongs to this user
    if (vehicle_id) {
      const [[veh]] = await conn.query('SELECT user_id FROM vehicles WHERE vehicle_id = ?', [vehicle_id]);
      if (!veh || veh.user_id !== req.user.user_id)
        return res.status(403).json({ error: 'Vehicle not found or not owned by you' });
    }

    const pts = calcPoints(total_amount);

    const [r] = await conn.query(
      `INSERT INTO transactions
        (user_id, vehicle_id, pump_id, station_id, fuel_type_id, litres, price_per_litre, total_amount, payment_method, points_earned, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,'completed')`,
      [req.user.user_id, vehicle_id||null, pump_id||null, station_id, fuel_type_id,
       litres, price_per_litre, total_amount, payment_method||'mobile_money', pts]
    );
    const txnId = r.insertId;

    // Update loyalty balance + total_spent
    await conn.query(
      'UPDATE loyalty SET points_balance = points_balance + ?, total_spent = total_spent + ? WHERE user_id = ?',
      [pts, total_amount, req.user.user_id]
    );

    // Recalculate tier
    const [[loy]] = await conn.query('SELECT total_spent FROM loyalty WHERE user_id = ?', [req.user.user_id]);
    const spent = parseFloat(loy.total_spent);
    const tier = calcTier(spent);
    await conn.query('UPDATE loyalty SET tier = ? WHERE user_id = ?', [tier, req.user.user_id]);

    // Log loyalty
    await conn.query(
      'INSERT INTO loyalty_transactions (user_id, points, type, description) VALUES (?, ?, "earned", ?)',
      [req.user.user_id, pts, `Fuelling at station #${station_id} — ${litres}L`]
    );

    // Free pump
    if (pump_id) await conn.query("UPDATE pumps SET status='available' WHERE pump_id=?", [pump_id]);

    await conn.commit();

    const [[full]] = await db.query(`${TXN_SELECT} WHERE t.transaction_id = ?`, [txnId]);

    const [[userRow]] = await db.query('SELECT email, full_name, phone, fcm_token FROM users WHERE user_id = ?', [req.user.user_id]);

    // CO₂ estimate (non-blocking — real Carbon Interface API, falls back to formula)
    let co2_kg = null;
    try {
      const co2 = await getCarbonEstimate(full.fuel_name, litres);
      co2_kg = co2?.co2_kg ?? null;
    } catch { /* non-fatal */ }
    // Fallback formula if Carbon Interface unavailable
    if (co2_kg === null) {
      const factors = { Petrol: 2.31, Diesel: 2.68, Premium: 2.33, LPG: 1.61, Paraffin: 2.52 };
      co2_kg = +((parseFloat(litres) * (factors[full.fuel_name] || 2.31)).toFixed(2));
    }

    // Persist CO₂ on the transaction row (non-blocking)
    db.query('UPDATE transactions SET co2_kg = ? WHERE transaction_id = ?', [co2_kg, txnId]).catch(() => {});

    // Send receipt email (non-blocking)
    sendReceiptEmail(userRow.email, {
        userName: userRow.full_name,
        transactionId: txnId,
        stationName: full.station_name,
        fuelType: full.fuel_name,
        litres,
        totalAmount: total_amount,
        paymentMethod: payment_method,
        createdAt: new Date(),
    }).catch(e => console.error('Receipt email error:', e.message));

    // FCM push notification (non-blocking)
    sendPush(
      userRow.fcm_token,
      'Payment Confirmed ⛽',
      `${parseFloat(litres).toFixed(2)}L at ${full.station_name} — M${parseFloat(total_amount).toFixed(2)}. +${pts} pts`,
      { transaction_id: String(txnId) }
    );

    // Budget push check (non-blocking)
    db.query(
      `SELECT u.fuel_budget, COALESCE(SUM(t2.total_amount),0) AS month_spend
       FROM users u
       LEFT JOIN transactions t2 ON t2.user_id = u.user_id
         AND MONTH(t2.transaction_date) = MONTH(NOW())
         AND YEAR(t2.transaction_date)  = YEAR(NOW())
         AND t2.status = 'completed'
       WHERE u.user_id = ?
       GROUP BY u.user_id`,
      [req.user.user_id]
    ).then(([rows]) => {
      const row = rows[0];
      if (!row || !row.fuel_budget) return;
      const pct = parseFloat(row.month_spend) / parseFloat(row.fuel_budget);
      if (pct >= 1.0) {
        sendPush(userRow.fcm_token, '⚠️ Budget Reached',
          `You've used 100% of your M${row.fuel_budget} fuel budget this month`);
      } else if (pct >= 0.8) {
        sendPush(userRow.fcm_token, '🔔 Budget Alert',
          `You've used ${(pct*100).toFixed(0)}% of your M${row.fuel_budget} fuel budget`);
      }
    }).catch(() => {});

    res.status(201).json({ ...full, points_earned: pts, co2_kg });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/transactions/:id/resend-email
router.post('/:id/resend-email', authMW(), async (req, res) => {
  try {
    const [[txn]] = await db.query(
      `${TXN_SELECT} WHERE t.transaction_id = ? AND t.user_id = ?`,
      [req.params.id, req.user.user_id]
    );
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const [[userRow]] = await db.query('SELECT email, full_name FROM users WHERE user_id = ?', [req.user.user_id]);

    await sendReceiptEmail(userRow.email, {
      userName:       userRow.full_name,
      transactionId:  txn.transaction_id,
      stationName:    txn.station_name,
      fuelType:       txn.fuel_name,
      litres:         txn.litres,
      totalAmount:    txn.total_amount,
      paymentMethod:  txn.payment_method,
      createdAt:      txn.transaction_date,
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
