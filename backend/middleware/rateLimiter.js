// ================================================
// FuelGO — rateLimiter.js
// Description: Express rate-limiting middleware
// Author: FuelGO Dev
// ================================================
const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // In development skip rate limiting to avoid accidental 429 from local tooling and rapid hot-reloads.
  // In production keep a reasonable default to protect the API.
  skip: (req) => process.env.NODE_ENV === 'development',
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Skip strict login rate limits during development or for local requests to avoid accidental 429s
  skip: (req) => process.env.NODE_ENV === 'development' || ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.ip),
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

// Stricter limiter for payment and transaction endpoints
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  // Allow local development to bypass strict payment rate limits
  skip: (req) => process.env.NODE_ENV === 'development' || ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.ip),
  max: 20,                   // max 20 payment/transaction requests per 5 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests, please slow down.' },
});

module.exports = { generalLimiter, authLimiter, paymentLimiter };
