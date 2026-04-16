// ================================================
// FuelGO — api.js
// Description: Centralized API client with auth, caching, and progress bar
// Author: FuelGO Dev
// ================================================

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5001/api'
  : `${window.location.origin}/api`;

// ── Token helpers ──────────────────────────────
function getToken()  { return localStorage.getItem('fuelgo_token'); }
function setToken(t) { localStorage.setItem('fuelgo_token', t); }
function clearToken(){ localStorage.removeItem('fuelgo_token'); localStorage.removeItem('fuelgo_user'); }
function setUser(u)  { localStorage.setItem('fuelgo_user', JSON.stringify(u)); }
function getUser()   { try { return JSON.parse(localStorage.getItem('fuelgo_user')); } catch (e) { return null; } }

// ── Core fetch wrapper ─────────────────────────
async function req(method, path, body) {
  if (typeof startProgress === 'function') startProgress();
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  // 15-second request timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15000);
  opts.signal = controller.signal;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (typeof finishProgress === 'function') finishProgress();
    const isTimeout = err.name === 'AbortError';
    const msg = isTimeout ? 'Request timed out. Check your connection.' : 'Unable to reach the server. Is the backend running?';
    if (typeof notify === 'function') notify('error', isTimeout ? 'Timeout' : 'Connection error', msg);
    throw new Error(isTimeout ? 'Request timed out' : 'Cannot reach server. Start the backend: cd backend && npm start');
  }

  if (typeof finishProgress === 'function') finishProgress();

  // Handle token refresh from server
  const refreshed = res.headers.get('X-Refreshed-Token');
  if (refreshed) setToken(refreshed);

  if (res.status === 401) {
    if (typeof notify === 'function') notify('warning', 'Session expired', 'Redirecting to login...', 3000);
    clearToken();
    setTimeout(() => { window.location.href = 'index.html'; }, 3000);
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

// ── API namespace ──────────────────────────────
const API = {

  auth: {
    login:   async (body)   => { const d = await req('POST', '/auth/login', body); setToken(d.token); setUser(d.user); return d; },
    register:async (body)   => { const d = await req('POST', '/auth/register', body); setToken(d.token); setUser(d.user); return d; },
    me:      ()             => req('GET',  '/auth/me'),
    profile:        (data)  => req('PUT',  '/auth/profile', data),
    changePassword: (data)  => req('PUT',  '/auth/password', data),
    logout:  ()             => { clearToken(); window.location.href = 'index.html'; },
  },

  stations: {
    getAll:   ()      => req('GET',  '/stations'),
    getById:  (id)    => req('GET',  `/stations/${id}`),
    getPumps: (id)    => req('GET',  `/stations/${id}/pumps`),
    create:   (data)  => req('POST', '/stations', data),
    update:   (id, d) => req('PUT',  `/stations/${id}`, d),
  },

  fuelTypes: {
    getAll:      ()          => req('GET', '/fuel-types'),
    update:      (id, data)  => req('PUT', `/fuel-types/${id}`, data),
    updatePrice: (id, price) => req('PUT', `/fuel-types/${id}`, { price_per_litre: price }),
  },

  vehicles: {
    getAll:  ()      => req('GET',    '/vehicles'),
    create:  (data)  => req('POST',   '/vehicles', data),
    update:  (id, d) => req('PUT',    `/vehicles/${id}`, d),
    delete:  (id)    => req('DELETE', `/vehicles/${id}`),
  },

  transactions: {
    getAll:  ()     => req('GET',  '/transactions'),
    getById: (id)   => req('GET',  `/transactions/${id}`),
    create:  (data) => req('POST', '/transactions', data),
  },

  loyalty: {
    get:             ()       => req('GET',  '/loyalty'),
    getTransactions: ()       => req('GET',  '/loyalty/transactions'),
    history:         ()       => req('GET',  '/loyalty/transactions'),
    getRewards:      ()       => req('GET',  '/loyalty/rewards'),
    redeem:          (rid)    => req('POST', '/loyalty/redeem', { reward_id: rid }),
  },

  admin: {
    overview:        ()          => req('GET',    '/admin/overview'),
    stations:        ()          => req('GET',    '/stations'),
    employees:       ()          => req('GET',    '/admin/employees'),
    addEmployee:     (data)      => req('POST',   '/admin/employees', data),
    updateEmployee:  (id, d)     => req('PUT',    `/admin/employees/${id}`, d),
    deleteEmployee:  (id)        => req('DELETE', `/admin/employees/${id}`),
    customers:       ()          => req('GET',    '/admin/customers'),
    revenueReport:   ()          => req('GET',    '/admin/reports/revenue'),
    fuelReport:      ()          => req('GET',    '/admin/reports/fuel'),
    updateFuelPrice: (id, price) => req('PUT',    `/fuel-types/${id}`, { price_per_litre: price }),
  },

  // Convenience aliases used by employee/admin dashboards
  reports: {
    stationSales:    () => req('GET', '/admin/reports/revenue'),
    fuelPerformance: () => req('GET', '/admin/reports/fuel'),
    employeeSales:   () => req('GET', '/admin/employees'),
  },

  employee: {
    dashboard:        ()            => req('GET', '/employee/dashboard'),
    updatePumpStatus: (id, status)  => req('PUT', `/employee/pumps/${id}/status`, { status }),
  },

  payments: {
    getConfig:    ()                         => req('GET',  '/payments/config'),
    createIntent: (amount_lsl, description)  => req('POST', '/payments/create-intent', { amount_lsl, description }),
  },

  push: {
    subscribe: (token) => req('POST', '/push/subscribe', { token }),
  },

  weather: {
    get:    (lat, lng) => req('GET', `/weather?lat=${lat}&lng=${lng}`),
    locate: ()         => req('GET', '/weather/locate'),
  },

  currency: {
    rates:   ()                          => req('GET', '/currency/rates'),
    convert: (amount, from, to)          => req('GET', `/currency/convert?amount=${amount}&from=${from}&to=${to}`),
  },

  upload: {
    avatar: async (file) => {
      if (typeof startProgress === 'function') startProgress();
      const form = new FormData();
      form.append('avatar', file);
      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      let res;
      try {
        res = await fetch(`${API_BASE}/upload/avatar`, { method: 'POST', headers, body: form });
      } catch {
        if (typeof finishProgress === 'function') finishProgress();
        throw new Error('Cannot reach server');
      }
      if (typeof finishProgress === 'function') finishProgress();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload error ${res.status}`);
      return data;
    },
  },
};

window.API      = API;
window.getUser  = getUser;
window.setUser  = setUser;
window.getToken = getToken;
// Expose raw request for one-off calls not in the API object
API.request = req;
