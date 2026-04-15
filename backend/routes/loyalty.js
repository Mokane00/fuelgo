const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');

// GET /api/loyalty
router.get('/', authMW(), async (req, res) => {
  try {
    const [[loy]] = await db.query('SELECT * FROM loyalty WHERE user_id = ?', [req.user.user_id]);
    res.json(loy || { points_balance: 0, tier: 'Bronze', total_spent: 0 });
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
router.post('/redeem', authMW(), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { reward_id } = req.body;
    const [[reward]] = await conn.query(
      'SELECT * FROM rewards WHERE reward_id = ? AND is_active = 1 AND stock > 0', [reward_id]
    );
    if (!reward) return res.status(404).json({ error: 'Reward not available' });

    const [[loy]] = await conn.query('SELECT * FROM loyalty WHERE user_id = ?', [req.user.user_id]);
    if (loy.points_balance < reward.points_required)
      return res.status(400).json({ error: 'Insufficient points' });

    await conn.query('UPDATE loyalty SET points_balance = points_balance - ? WHERE user_id = ?',
      [reward.points_required, req.user.user_id]);
    await conn.query('UPDATE rewards SET stock = stock - 1 WHERE reward_id = ?', [reward_id]);
    await conn.query(
      'INSERT INTO loyalty_transactions (user_id, points, type, description) VALUES (?, ?, "redeemed", ?)',
      [req.user.user_id, -reward.points_required, `Redeemed: ${reward.reward_name}`]
    );

    await conn.commit();
    res.json({ success: true, new_balance: loy.points_balance - reward.points_required });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
