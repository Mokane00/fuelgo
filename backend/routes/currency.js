// ================================================
// FuelGO — routes/currency.js
// Description: Open Exchange Rates — LSL/ZAR/USD
// ================================================
const router = require('express').Router();
const { getRates, convert } = require('../utils/currency');

/**
 * GET /api/currency/rates
 * Returns latest rates for LSL, ZAR, USD, GBP, EUR.
 * Cached for 1 hour on the server.
 */
router.get('/rates', async (req, res) => {
  const rates = await getRates();
  if (!rates) return res.status(503).json({ error: 'Currency service unavailable' });
  res.json({ base: 'USD', rates });
});

/**
 * GET /api/currency/convert?amount=100&from=LSL&to=ZAR
 */
router.get('/convert', async (req, res) => {
  const { amount, from, to } = req.query;
  if (!amount || !from || !to) return res.status(400).json({ error: 'amount, from, and to required' });
  const result = await convert(parseFloat(amount), from.toUpperCase(), to.toUpperCase());
  if (result === null) return res.status(503).json({ error: 'Currency service unavailable' });
  res.json({ amount: parseFloat(amount), from, to, result });
});

module.exports = router;
