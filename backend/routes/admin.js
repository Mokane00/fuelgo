const router   = require('express').Router();
const db       = require('../db');
const authMW   = require('../middleware/auth');
const bcrypt   = require('bcryptjs');
const audit    = require('../middleware/audit');

// Ensure users.is_active column exists (migration-safe)
db.query("ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1").catch(() => {});

// ── Overview KPIs ─────────────────────────────────────────
router.get('/overview', authMW(['admin']), async (req, res) => {
  try {
    const [[sc]]  = await db.query("SELECT COUNT(*) c FROM stations WHERE status='active'");
    const [[cc]]  = await db.query("SELECT COUNT(*) c FROM users WHERE role='customer'");
    const [[ec]]  = await db.query("SELECT COUNT(*) c FROM users WHERE role='employee'");
    const today   = new Date().toISOString().slice(0,10);
    const [[td]]  = await db.query(
      "SELECT COUNT(*) c, COALESCE(SUM(total_amount),0) r FROM transactions WHERE DATE(transaction_date)=?", [today]);
    const first   = new Date(); first.setDate(1);
    const [[mr]]  = await db.query(
      "SELECT COALESCE(SUM(total_amount),0) r FROM transactions WHERE transaction_date >= ?",
      [first.toISOString().slice(0,10)]);
    const [[ar]]  = await db.query("SELECT COALESCE(SUM(total_amount),0) r FROM transactions");

    const [daily] = await db.query(`
      SELECT DATE(transaction_date) date, SUM(total_amount) revenue
      FROM transactions WHERE transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(transaction_date) ORDER BY date`);

    const [fuel] = await db.query(`
      SELECT ft.fuel_name,
             COALESCE(SUM(t.litres), 0)        AS litres,
             COALESCE(SUM(t.total_amount), 0)  AS revenue
      FROM transactions t JOIN fuel_types ft ON t.fuel_type_id = ft.fuel_type_id
      GROUP BY ft.fuel_type_id, ft.fuel_name ORDER BY revenue DESC`);

    res.json({
      total_stations:       sc.c,
      total_customers:      cc.c,
      total_employees:      ec.c,
      transactions_today:   td.c,
      revenue_today:        td.r,
      revenue_this_month:   mr.r,
      total_revenue_all_time: ar.r,
      daily_revenue:        daily,
      fuel_breakdown:       fuel
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── All Users (unified, for admin user management) ────────
router.get('/users', authMW(['admin']), async (req, res) => {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const like   = `%${search}%`;
    const [rows] = await db.query(`
      SELECT u.user_id AS id, u.full_name AS name, u.email, u.phone,
             u.role, u.is_active, u.created_at,
             u.station_id, s.station_name
      FROM users u
      LEFT JOIN stations s ON u.station_id = s.station_id
      WHERE u.full_name LIKE ? OR u.email LIKE ?
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
      [like, like, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM users WHERE full_name LIKE ? OR email LIKE ?',
      [like, like]
    );
    res.json({ users: rows, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', authMW(['admin']), async (req, res) => {
  try {
    const { full_name, email, phone, role, password, station_id } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: 'full_name, email and password are required' });
    const hash = await bcrypt.hash(password, 12);
    const [r] = await db.query(
      'INSERT INTO users (full_name, email, phone, password_hash, role, station_id) VALUES (?,?,?,?,?,?)',
      [full_name, email.toLowerCase(), phone || null, hash, role || 'customer', station_id || null]
    );
    await audit({ req, action: 'CREATE_USER', targetType: 'user', targetId: r.insertId, targetLabel: email, metadata: { full_name, role: role || 'customer', station_id: station_id || null } });
    res.status(201).json({ user_id: r.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id', authMW(['admin']), async (req, res) => {
  try {
    const { full_name, email, phone, role, is_active, station_id } = req.body;
    const [[before]] = await db.query('SELECT full_name, email, phone, role, is_active, station_id FROM users WHERE user_id=?', [req.params.id]);
    await db.query(
      'UPDATE users SET full_name=?, email=?, phone=?, role=?, is_active=?, station_id=? WHERE user_id=?',
      [full_name, email, phone || null, role, is_active ? 1 : 0, station_id || null, req.params.id]
    );
    await audit({ req, action: 'UPDATE_USER', targetType: 'user', targetId: Number(req.params.id), targetLabel: email, metadata: { before, after: { full_name, email, phone, role, is_active, station_id: station_id || null } } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', authMW(['admin']), async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT email, role FROM users WHERE user_id=?', [req.params.id]);
    const [r] = await db.query(
      "DELETE FROM users WHERE user_id = ? AND role != 'admin'", [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'User not found or cannot delete admin' });
    await audit({ req, action: 'DELETE_USER', targetType: 'user', targetId: Number(req.params.id), targetLabel: user?.email ?? '', metadata: { role: user?.role } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Loyalty report ─────────────────────────────────────────
router.get('/loyalty-report', authMW(['admin']), async (req, res) => {
  try {
    const [[issued]]   = await db.query(
      "SELECT COALESCE(SUM(points), 0) AS total FROM loyalty_transactions WHERE points > 0"
    );
    const [[redeemed]] = await db.query(
      "SELECT COALESCE(SUM(ABS(points)), 0) AS total FROM loyalty_transactions WHERE points < 0"
    );
    const [topEarners] = await db.query(`
      SELECT u.full_name AS name, u.email,
             COALESCE(SUM(lt.points), 0) AS points
      FROM users u
      LEFT JOIN loyalty_transactions lt ON lt.user_id = u.user_id AND lt.points > 0
      WHERE u.role = 'customer'
      GROUP BY u.user_id
      ORDER BY points DESC
      LIMIT 10`);
    res.json({
      total_points_issued:   parseInt(issued.total)   || 0,
      total_points_redeemed: parseInt(redeemed.total) || 0,
      top_earners: topEarners,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Transactions (normalised, for reports page) ────────────
router.get('/transactions', authMW(['admin']), async (req, res) => {
  try {
    const { from, to } = req.query;
    const start = from || new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
    const end   = to   || new Date().toISOString().slice(0,10);
    const [rows] = await db.query(`
      SELECT t.transaction_id AS id,
             t.transaction_date AS created_at,
             u.full_name  AS customer_name,
             s.station_name,
             ft.fuel_name,
             t.litres, t.price_per_litre,
             t.total_amount AS amount,
             t.payment_method, t.points_earned, t.status
      FROM transactions t
      JOIN users      u  ON t.user_id      = u.user_id
      JOIN stations   s  ON t.station_id   = s.station_id
      JOIN fuel_types ft ON t.fuel_type_id = ft.fuel_type_id
      WHERE DATE(t.transaction_date) BETWEEN ? AND ?
      ORDER BY t.transaction_date DESC
      LIMIT 500`,
      [start, end]);
    res.json({ transactions: rows, total: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Employees ─────────────────────────────────────────────
router.get('/employees', authMW(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.station_id, u.created_at,
             s.station_name, s.district,
             COUNT(t.transaction_id) transactions_today,
             COALESCE(SUM(t.total_amount), 0) revenue_today
      FROM users u
      LEFT JOIN stations s ON u.station_id = s.station_id
      LEFT JOIN transactions t ON t.station_id = u.station_id AND DATE(t.transaction_date) = CURDATE()
      WHERE u.role IN ('employee','admin')
      GROUP BY u.user_id
      ORDER BY s.station_name, u.full_name`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/employees', authMW(['admin']), async (req, res) => {
  try {
    const { full_name, email, phone, station_id, role, password } = req.body;
    const hash = await bcrypt.hash(password || 'FuelGO@2024', 12);
    const [r] = await db.query(
      'INSERT INTO users (full_name, email, phone, password_hash, role, station_id) VALUES (?,?,?,?,?,?)',
      [full_name, email.toLowerCase(), phone, hash, role || 'employee', station_id]
    );
    await audit({ req, action: 'CREATE_EMPLOYEE', targetType: 'user', targetId: r.insertId, targetLabel: email, metadata: { full_name, role: role || 'employee', station_id } });
    res.status(201).json({ user_id: r.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/employees/:id', authMW(['admin']), async (req, res) => {
  try {
    const { full_name, email, phone, station_id, role } = req.body;
    await db.query(
      'UPDATE users SET full_name=?, email=?, phone=?, station_id=?, role=? WHERE user_id=?',
      [full_name, email, phone, station_id, role, req.params.id]
    );
    await audit({ req, action: 'UPDATE_EMPLOYEE', targetType: 'user', targetId: Number(req.params.id), targetLabel: email, metadata: { full_name, role, station_id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/employees/:id', authMW(['admin']), async (req, res) => {
  try {
    const [[emp]] = await db.query('SELECT email FROM users WHERE user_id=?', [req.params.id]);
    const [r] = await db.query(
      "DELETE FROM users WHERE user_id=? AND role != 'admin'", [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Employee not found or cannot delete admin' });
    await audit({ req, action: 'DELETE_EMPLOYEE', targetType: 'user', targetId: Number(req.params.id), targetLabel: emp?.email ?? '' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Customers ─────────────────────────────────────────────
router.get('/customers', authMW(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.user_id, u.full_name, u.email, u.phone, u.created_at,
             l.points_balance, l.tier, l.total_spent,
             COUNT(t.transaction_id) total_transactions
      FROM users u
      LEFT JOIN loyalty l ON l.user_id = u.user_id
      LEFT JOIN transactions t ON t.user_id = u.user_id
      WHERE u.role = 'customer'
      GROUP BY u.user_id ORDER BY l.total_spent DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Reports ───────────────────────────────────────────────
router.get('/reports/revenue', authMW(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.station_name, s.district,
             COUNT(t.transaction_id) txns,
             SUM(t.litres) litres,
             SUM(t.total_amount) revenue
      FROM transactions t JOIN stations s ON t.station_id = s.station_id
      GROUP BY t.station_id ORDER BY revenue DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/fuel', authMW(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ft.fuel_name, ft.price_per_litre,
             COUNT(t.transaction_id) txns,
             COALESCE(SUM(t.litres), 0) litres,
             COALESCE(SUM(t.total_amount), 0) revenue
      FROM fuel_types ft LEFT JOIN transactions t ON t.fuel_type_id = ft.fuel_type_id
      GROUP BY ft.fuel_type_id ORDER BY revenue DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Report: Customer Loyalty Summary ──────────────────────
router.get('/reports/loyalty', authMW(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.user_id, u.full_name, u.email, u.phone, u.created_at,
             l.points_balance, l.tier, l.total_spent,
             COUNT(DISTINCT t.transaction_id)   AS total_transactions,
             COALESCE(SUM(t.litres), 0)         AS total_litres,
             COALESCE(SUM(lt.points), 0)        AS total_points_earned,
             MAX(t.transaction_date)             AS last_transaction
      FROM users u
      JOIN    loyalty              l  ON l.user_id  = u.user_id
      LEFT JOIN transactions       t  ON t.user_id  = u.user_id
      LEFT JOIN loyalty_transactions lt ON lt.user_id = u.user_id AND lt.type = 'earned'
      WHERE u.role = 'customer'
      GROUP BY u.user_id, l.points_balance, l.tier, l.total_spent
      ORDER BY l.total_spent DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Report: Station Ratings & Reviews ─────────────────────
router.get('/reports/ratings', authMW(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.station_id, s.station_name, s.district, s.status,
             COUNT(sr.rating_id)               AS review_count,
             ROUND(AVG(sr.rating), 2)           AS avg_rating,
             SUM(sr.rating = 5)                 AS five_star,
             SUM(sr.rating = 4)                 AS four_star,
             SUM(sr.rating <= 3)                AS three_or_less,
             COUNT(DISTINCT t.transaction_id)   AS total_transactions,
             COALESCE(SUM(t.total_amount), 0)   AS total_revenue
      FROM stations s
      LEFT JOIN station_ratings sr ON sr.station_id = s.station_id
      LEFT JOIN transactions     t  ON t.station_id  = s.station_id
      GROUP BY s.station_id, s.station_name, s.district, s.status
      ORDER BY avg_rating DESC, review_count DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Report: Transaction Detail (date-ranged) ───────────────
router.get('/reports/transactions', authMW(['admin']), async (req, res) => {
  try {
    const { from, to } = req.query;
    const start = from || new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
    const end   = to   || new Date().toISOString().slice(0,10);
    const [rows] = await db.query(`
      SELECT t.transaction_id, t.transaction_date,
             u.full_name  AS customer_name, u.email AS customer_email,
             s.station_name, s.district,
             ft.fuel_name, t.litres, t.price_per_litre,
             t.total_amount, t.payment_method, t.points_earned,
             v.plate_number, v.make, v.model AS vehicle_model
      FROM transactions t
      JOIN users      u  ON t.user_id      = u.user_id
      JOIN stations   s  ON t.station_id   = s.station_id
      JOIN fuel_types ft ON t.fuel_type_id = ft.fuel_type_id
      LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
      WHERE DATE(t.transaction_date) BETWEEN ? AND ?
      ORDER BY t.transaction_date DESC
      LIMIT 500`,
      [start, end]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Audit Logs ────────────────────────────────────────────
router.get('/audit-logs', authMW(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 50, action = '', search = '', from, to } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params     = [];

    if (action) { conditions.push('al.action = ?'); params.push(action); }
    if (search) {
      conditions.push('(al.actor_email LIKE ? OR al.target_label LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (from) { conditions.push('DATE(al.created_at) >= ?'); params.push(from); }
    if (to)   { conditions.push('DATE(al.created_at) <= ?'); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT al.log_id, al.actor_id, al.actor_email, al.actor_role,
              al.action, al.target_type, al.target_id, al.target_label,
              al.ip_address, al.metadata, al.created_at
       FROM audit_logs al
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_logs al ${where}`,
      params
    );

    const [actions] = await db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');

    res.json({ logs: rows, total, actions: actions.map(a => a.action) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
