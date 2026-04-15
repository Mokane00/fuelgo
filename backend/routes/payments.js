// ================================================
// FuelGO — routes/payments.js
// Description: Stripe + M-Pesa payment routes
// ================================================
const router  = require('express').Router();
const Stripe  = require('stripe');
const authMW  = require('../middleware/auth');
const db      = require('../db');
const { stkPush, stkQuery } = require('../utils/mpesa');

// In-memory store for pending M-Pesa requests: CheckoutRequestID → { status, resultCode }
// (Replace with Redis in production for multi-process deployments)
const mpesaPending = new Map();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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
  try {
    const { amount_lsl, description } = req.body;
    if (!amount_lsl || isNaN(amount_lsl) || amount_lsl <= 0) {
      return res.status(400).json({ error: 'Valid amount_lsl is required' });
    }

    // Stripe amounts are in smallest currency unit (cents / lisente for LSL)
    const amountLisente = Math.round(parseFloat(amount_lsl) * 100);

    const intent = await stripe.paymentIntents.create({
      amount:      amountLisente,
      currency:    'lsl',
      description: description || 'FuelGO fuel purchase',
      metadata:    { user_id: String(req.user.user_id), email: req.user.email },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ client_secret: intent.client_secret, payment_intent_id: intent.id });
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

// ─────────────────────────────────────────────────
//  M-Pesa STK Push
// ─────────────────────────────────────────────────

/**
 * POST /api/payments/mpesa/push
 * Initiates an M-Pesa STK push to the customer's phone.
 * Body: { phone, amount, ref }
 * Returns: { checkoutRequestId, customerMessage }
 */
router.post('/mpesa/push', authMW(), async (req, res) => {
  const { phone, amount, ref } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

  if (!process.env.MPESA_CONSUMER_KEY) {
    return res.status(503).json({ error: 'M-Pesa not configured' });
  }

  try {
    const result = await stkPush(phone, amount, ref || 'FuelGO');
    if (!result || result.ResponseCode !== '0') {
      return res.status(502).json({ error: result?.errorMessage || result?.CustomerMessage || 'STK push failed' });
    }

    const id = result.CheckoutRequestID;
    // Track as pending
    mpesaPending.set(id, { status: 'pending', ts: Date.now() });
    // Auto-expire after 5 minutes
    setTimeout(() => mpesaPending.delete(id), 5 * 60 * 1000);

    res.json({ checkoutRequestId: id, customerMessage: result.CustomerMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/payments/mpesa/status/:checkoutId
 * Poll M-Pesa payment status.
 * Returns: { status: "pending" | "success" | "failed", message }
 */
router.get('/mpesa/status/:checkoutId', authMW(), async (req, res) => {
  const { checkoutId } = req.params;

  // Check our in-memory store first (updated by callback)
  const stored = mpesaPending.get(checkoutId);
  if (stored && stored.status !== 'pending') {
    return res.json({ status: stored.status, message: stored.message });
  }

  // Query Daraja directly
  try {
    const result = await stkQuery(checkoutId);
    if (!result) return res.json({ status: 'pending' });

    const code = String(result.ResultCode ?? result.errorCode ?? '');
    if (code === '0') {
      mpesaPending.set(checkoutId, { status: 'success', message: result.ResultDesc });
      return res.json({ status: 'success', message: result.ResultDesc });
    }
    if (code === '1032') {
      // User cancelled
      mpesaPending.set(checkoutId, { status: 'failed', message: 'Payment cancelled by user.' });
      return res.json({ status: 'failed', message: 'Payment cancelled by user.' });
    }
    if (result.ResultDesc) {
      mpesaPending.set(checkoutId, { status: 'failed', message: result.ResultDesc });
      return res.json({ status: 'failed', message: result.ResultDesc });
    }
    // Still processing
    res.json({ status: 'pending' });
  } catch (err) {
    res.json({ status: 'pending' });
  }
});

/**
 * POST /api/payments/mpesa/callback
 * Daraja calls this URL with the final payment result.
 * Must be a publicly accessible HTTPS URL (use ngrok in dev).
 */
router.post('/mpesa/callback', (req, res) => {
  const body = req.body?.Body?.stkCallback;
  if (body) {
    const id   = body.CheckoutRequestID;
    const code = String(body.ResultCode);
    if (mpesaPending.has(id)) {
      mpesaPending.set(id, {
        status:  code === '0' ? 'success' : 'failed',
        message: body.ResultDesc,
      });
    }
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = router;
