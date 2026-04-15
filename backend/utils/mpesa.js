// ================================================
// FuelGO — utils/mpesa.js
// Description: Safaricom Daraja M-Pesa STK Push
// Env vars needed:
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET
//   MPESA_SHORTCODE, MPESA_PASSKEY
//   MPESA_CALLBACK_URL  (publicly accessible URL)
//   MPESA_ENV           ("sandbox" | "production")
// ================================================

const BASE = {
  sandbox:    'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

function getBase() {
  return BASE[process.env.MPESA_ENV || 'sandbox'];
}

// ── OAuth token (cached 55 minutes) ─────────────
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) return null;

  const creds = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(
    `${getBase()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${creds}` } }
  );
  if (!res.ok) return null;
  const d = await res.json();
  _token = d.access_token;
  _tokenExpiry = Date.now() + 55 * 60 * 1000;
  return _token;
}

// ── Build password ────────────────────────────────
function buildPassword(timestamp) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

function getTimestamp() {
  return new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
}

// Format Lesotho number (+266 5XXXXXXX) → 2665XXXXXXX
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('266')) return digits;
  if (digits.startsWith('0'))   return '266' + digits.slice(1);
  return '266' + digits;
}

// ── STK Push ──────────────────────────────────────
/**
 * Initiate an M-Pesa STK (Lipa na M-Pesa) push to the customer's phone.
 * @param {string} phone   - customer phone (+266 5XXXXXXX or local format)
 * @param {number} amount  - LSL amount (rounded to nearest integer by Daraja)
 * @param {string} ref     - transaction reference e.g. "TXN-00123"
 * @returns {{ CheckoutRequestID, ResponseCode, CustomerMessage }} or null on failure
 */
async function stkPush(phone, amount, ref = 'FuelGO') {
  const token = await getToken();
  if (!token) return null;

  const shortcode = process.env.MPESA_SHORTCODE;
  const callback  = process.env.MPESA_CALLBACK_URL;
  const ts        = getTimestamp();

  const body = {
    BusinessShortCode: shortcode,
    Password:          buildPassword(ts),
    Timestamp:         ts,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            Math.max(1, Math.round(parseFloat(amount))),
    PartyA:            formatPhone(phone),
    PartyB:            shortcode,
    PhoneNumber:       formatPhone(phone),
    CallBackURL:       callback,
    AccountReference:  'FuelGO',
    TransactionDesc:   ref,
  };

  const res = await fetch(`${getBase()}/mpesa/stkpush/v1/processrequest`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await res.json();
  return data;
}

// ── STK Query (poll status) ───────────────────────
/**
 * Query the status of a pending STK push.
 * @param {string} checkoutRequestId  - from stkPush() response
 * @returns {{ ResultCode, ResultDesc }} or null
 */
async function stkQuery(checkoutRequestId) {
  const token = await getToken();
  if (!token) return null;

  const shortcode = process.env.MPESA_SHORTCODE;
  const ts        = getTimestamp();

  const body = {
    BusinessShortCode: shortcode,
    Password:          buildPassword(ts),
    Timestamp:         ts,
    CheckoutRequestID: checkoutRequestId,
  };

  const res = await fetch(`${getBase()}/mpesa/stkpushquery/v1/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  return res.json();
}

module.exports = { stkPush, stkQuery, formatPhone };
