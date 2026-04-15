// ================================================
// FuelGO — rateLimiter.js
// Description: Express rate-limiting middleware
// Author: FuelGO Dev
// ================================================
const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

// Stricter limiter for payment and transaction endpoints
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: 20,                   // max 20 payment/transaction requests per 5 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests, please slow down.' },
});

module.exports = { generalLimiter, authLimiter, paymentLimiter };
