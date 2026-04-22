const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');

// Tier thresholds (must match pointsCalculator.js calcTier)
const TIER_NEXT = {
  Bronze:   { next: 'Silver',   threshold: 5000  },
  Silver:   { next: 'Gold',     threshold: 20000 },
  Gold:     { next: 'Platinum', threshold: 50000 },
  Platinum: { next: null,       threshold: null   },
};

// GET /api/loyalty
router.get('/', authMW(), async (req, res) => {
  try {
    const [[loy]] = await db.query('SELECT * FROM loyalty WHERE user_id = ?', [req.user.user_id]);
    const base = loy || { points_balance: 0, tier: 'Bronze', total_spent: 0 };

    // Totals from loyalty_transactions
    const [[earned]]   = await db.query(
      "SELECT COALESCE(SUM(points), 0) AS total FROM loyalty_transactions WHERE user_id = ? AND points > 0",
      [req.user.user_id]
    );
    const [[redeemed]] = await db.query(
      "SELECT COALESCE(SUM(ABS(points)), 0) AS total FROM loyalty_transactions WHERE user_id = ? AND points < 0",
      [req.user.user_id]
    );

    // Points to next tier (based on total_spent)
    const tierInfo = TIER_NEXT[base.tier] || TIER_NEXT.Bronze;
    const totalSpent = parseFloat(base.total_spent || 0);
    const pointsToNextTier = tierInfo.threshold !== null
      ? Math.max(0, tierInfo.threshold - totalSpent)
      : 0;

    // History (last 50 loyalty transactions)
    const [history] = await db.query(
      `SELECT lt_id AS id, user_id, points, type, description, created_at
       FROM loyalty_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.user_id]
    );

    res.json({
      points_balance:     parseInt(base.points_balance) || 0,
      tier:               base.tier,
      total_spent:        parseFloat(base.total_spent) || 0,
      total_earned:       parseInt(earned.total) || 0,
      total_redeemed:     parseInt(redeemed.total) || 0,
      points_to_next_tier: pointsToNextTier,
      next_tier:          tierInfo.next,
      history,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/loyalty/transactions
router.get('/transactions', authMW(), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM loyalty_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/loyalty/rewards
router.get('/rewards', async (req, res) => {
  try {
    const [rewards] = await db.query('SELECT * FROM rewards WHERE is_active = 1 ORDER BY points_required');
    res.json(rewards);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/loyalty/redeem
// Body: { points } — deduct points directly (no reward_id required)
router.post('/redeem', authMW(), async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const { points } = req.body;
    const pts = parseInt(points);
    if (!pts || pts <= 0) {
      return res.status(400).json({ error: 'Valid points amount is required' });
    }

    const [[loy]] = await conn.query('SELECT * FROM loyalty WHERE user_id = ?', [req.user.user_id]);
    if (!loy || loy.points_balance < pts) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    await conn.query(
      'UPDATE loyalty SET points_balance = points_balance - ? WHERE user_id = ?',
      [pts, req.user.user_id]
    );
    await conn.query(
      'INSERT INTO loyalty_transactions (user_id, points, type, description) VALUES (?, ?, "redeemed", ?)',
      [req.user.user_id, -pts, `Redeemed ${pts} points for M${(pts / 100).toFixed(2)} discount`]
    );

    await conn.commit();
    res.json({ success: true, new_balance: loy.points_balance - pts });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
