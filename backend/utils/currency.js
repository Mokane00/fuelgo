// ================================================
// FuelGO — utils/currency.js
// Description: Open Exchange Rates — LSL/ZAR/USD
// ================================================

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch latest exchange rates (base USD).
 * Caches for 1 hour to stay within free-tier limits (1000 req/month).
 * Returns { LSL, ZAR, USD:1, GBP, EUR, ... } or null on error.
 */
async function getRates() {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
  const id = process.env.EXCHANGE_RATES_APP_ID;
  if (!id) return null;
  try {
    const res = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${id}&symbols=LSL,ZAR,USD,GBP,EUR`);
    if (!res.ok) return null;
    const d = await res.json();
    _cache     = d.rates;
    _cacheTime = Date.now();
    return _cache;
  } catch { return null; }
}

/**
 * Convert an amount from one currency to another.
 * convert(100, 'LSL', 'ZAR')
 */
async function convert(amount, from, to) {
  const rates = await getRates();
  if (!rates) return null;
  const inUSD = amount / (rates[from] || 1);
  return +(inUSD * (rates[to] || 1)).toFixed(2);
}

module.exports = { getRates, convert };
