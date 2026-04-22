// ================================================
// FuelGO — routes/payments.js
// Description: Stripe + M-Pesa payment routes
// ================================================
const router  = require('express').Router();
const Stripe  = require('stripe');
const authMW  = require('../middleware/auth');
const db      = require('../db');

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

/**
 * GET /api/payments/config
 * Returns the Stripe publishable key for the frontend.
 */
router.get('/config', authMW(), (req, res) => {
  res.json({ publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || null });
});

/**
 * POST /api/payments/create-intent
 * Creates a Stripe PaymentIntent for card payments.
 * Body: { amount_lsl, currency?, description? }
 * Returns: { client_secret, payment_intent_id }
 */
router.post('/create-intent', authMW(), async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payment processing not configured' });
  try {
    // Accept both amount_lsl (canonical) and amount (alias from frontend)
    const rawAmount = req.body.amount_lsl ?? req.body.amount;
    const { description } = req.body;
    if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Stripe amounts are in smallest currency unit (cents / lisente for LSL)
    const amountLisente = Math.round(parseFloat(rawAmount) * 100);

    const intent = await stripe.paymentIntents.create({
      amount:      amountLisente,
      currency:    'lsl',
      description: description || 'FuelGO fuel purchase',
      metadata:    { user_id: String(req.user.user_id), email: req.user.email },
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      client_secret:      intent.client_secret,
      clientSecret:       intent.client_secret,   // camelCase alias for React frontend
      payment_intent_id:  intent.id,
    });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/webhook
 * Stripe webhook for async payment status updates (optional)
 */
router.post('/webhook', require('express').raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = JSON.parse(req.body);
    }
  } catch (err) {
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    console.log('PaymentIntent succeeded:', event.data.object.id);
  }

  res.json({ received: true });
});

/**
 * GET /api/payments/maps-config
 * Returns the Google Maps API key from env so it never lives in frontend HTML.
 * Restrict this key in Google Cloud Console to your domain for production.
 */
router.get('/maps-config', (req, res) => {
  res.json({ maps_key: process.env.GOOGLE_MAPS_KEY || '' });
});

module.exports = router;
