/**
 * FuelGO — Auth & UI Utilities
 */

// ─── getCurrentUser (reads from localStorage set by api.js) ───
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('fuelgo_user')); } catch { return null; }
}

// ─── Auth Guards ───
function requireAuth(allowedRoles = []) {
  const token = localStorage.getItem('fuelgo_token');
  const user  = getCurrentUser();
  if (!token || !user) { window.location.href = 'index.html'; return null; }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    showToast('Access denied', 'danger');
    const map = { customer: 'dashboard.html', employee: 'employee-dashboard.html', admin: 'admin-dashboard.html' };
    setTimeout(() => window.location.href = map[user.role] || 'dashboard.html', 1200);
    return null;
  }
  return user;
}

function redirectIfLoggedIn() {
  const user = getCurrentUser();
  if (!user) return;
  const map = { customer: 'dashboard.html', employee: 'employee-dashboard.html', admin: 'admin-dashboard.html' };
  window.location.href = map[user.role] || 'dashboard.html';
}

// ─── Toast Notifications ───
// Bridge: showToast routes to the new notify() system when available
function showToast(message, type = 'info', duration = 3500) {
  // Map legacy type names
  const typeMap = { danger: 'error', success: 'success', warning: 'warning', info: 'info' };
  const notifyType = typeMap[type] || 'info';
  if (typeof notify === 'function') {
    notify(notifyType, '', message, duration);
    return;
  }
  // Fallback plain toast if notifications.js not loaded
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText = 'background:#fff;border-left:4px solid #F97316;border-radius:8px;padding:12px 16px;box-shadow:0 4px 16px rgba(0,0,0,.15);font-size:0.9rem;max-width:320px;pointer-events:all';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ─── Modal Manager ───
function openModal(id)  {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.classList.remove('closing'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('closing'); document.body.style.overflow = ''; setTimeout(() => { el.style.display = 'none'; el.classList.remove('closing'); }, 200); }
}
function closeModalOnOverlay(event, id) {
  if (event.target === document.getElementById(id)) closeModal(id);
}

// ─── Loading State ───
function setLoading(show = true, text = 'Loading…') {
  let screen = document.getElementById('loading-screen');
  if (show) {
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'loading-screen';
      screen.className = 'loading-screen';
      screen.innerHTML = `<div class="spinner spinner-lg"></div><p class="loading-text">${text}</p>`;
      document.body.appendChild(screen);
    }
    screen.style.display = 'flex';
  } else if (screen) {
    screen.style.display = 'none';
  }
}

// ─── Button Loading ───
function setBtnLoading(btn, loading = true) {
  if (loading) {
    btn._original = btn.innerHTML;
    btn.classList.add('btn-loading');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm" style="margin-right:8px"></span> Processing…';
  } else {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    btn.innerHTML = btn._original || '';
  }
}

// ─── Form Validation ───
function validateEmail(email)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePhone(phone)  { return /^\+?[\d\s\-()]{8,20}$/.test(phone); }
function validatePassword(pw)  {
  const s = { score: 0, level: 'weak' };
  if (pw.length >= 8)          s.score++;
  if (/[A-Z]/.test(pw))       s.score++;
  if (/[0-9]/.test(pw))       s.score++;
  if (/[^A-Za-z0-9]/.test(pw))s.score++;
  s.level = s.score <= 1 ? 'weak' : s.score === 2 ? 'fair' : 'strong';
  return s;
}
function setFieldState(input, state, message = '') {
  const group    = input.closest('.form-group');
  const feedback = group?.querySelector('.form-feedback');
  input.classList.remove('is-valid','is-invalid');
  if (state === 'valid')   input.classList.add('is-valid');
  if (state === 'invalid') input.classList.add('is-invalid');
  if (feedback) { feedback.textContent = message; feedback.className = `form-feedback ${state}`; }
}

// ─── Formatting ───
function formatDate(d)      { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
function formatDateTime(d)  { if (!d) return '—'; return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function formatCurrency(n)  { return `M ${parseFloat(n||0).toLocaleString('en-LS',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function formatLitres(n)    { return `${parseFloat(n||0).toFixed(1)} L`; }
function formatPoints(n)    { return `${parseInt(n||0).toLocaleString()} pts`; }

// ─── Ripple Effect ───
function addRipple(btn) {
  btn.addEventListener('click', function(e) {
    const r = document.createElement('span'); r.className = 'ripple';
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
    this.appendChild(r);
    setTimeout(() => r.remove(), 600);
  });
}

// ─── Dark Mode ───────────────────────────────────
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('fuelgo_theme', dark ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.innerHTML = dark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  setupChartTheme(dark);
}

// ─── Chart.js Dark Mode Defaults ─────────────────
function setupChartTheme(dark) {
  if (typeof Chart === 'undefined') return;
  const textColor = dark ? '#94a3b8' : '#64748b';
  const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;
  Chart.defaults.plugins = Chart.defaults.plugins || {};
  if (Chart.defaults.plugins.legend) Chart.defaults.plugins.legend.labels = { ...(Chart.defaults.plugins.legend.labels || {}), color: textColor };
}
function initTheme() {
  const saved = localStorage.getItem('fuelgo_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = saved ? saved === 'dark' : prefersDark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  // Apply chart theme after a tick so Chart.js has time to load
  setTimeout(() => setupChartTheme(dark), 0);
}

// ─── Build Navigation (Font Awesome icons) ───
function buildNav(role = 'customer') {
  const configs = {
    customer: [
      { icon: 'fa-solid fa-gauge',             label: 'Home',      href: 'dashboard.html' },
      { icon: 'fa-solid fa-location-dot',      label: 'Stations',  href: 'stations.html' },
      { icon: 'fa-solid fa-gas-pump',          label: 'Pay',       href: 'pump.html',     special: true },
      { icon: 'fa-solid fa-clock-rotate-left', label: 'History',   href: 'history.html' },
      { icon: 'fa-solid fa-star',              label: 'Loyalty',   href: 'loyalty.html' },
      { icon: 'fa-solid fa-chart-pie',         label: 'Analytics', href: 'analytics.html', sidebarOnly: true },
      { icon: 'fa-regular fa-circle-user',     label: 'Profile',   href: 'profile.html',   sidebarOnly: true },
    ],
    employee: [
      { icon: 'fa-solid fa-gauge',             label: 'Dashboard', href: 'employee-dashboard.html' },
      { icon: 'fa-solid fa-gas-pump',          label: 'Pumps',     href: 'employee-dashboard.html#pumps' },
      { icon: 'fa-solid fa-chart-bar',         label: 'Reports',   href: 'employee-dashboard.html#reports', special: true },
      { icon: 'fa-solid fa-clock-rotate-left', label: 'History',   href: 'history.html' },
      { icon: 'fa-regular fa-circle-user',     label: 'Profile',   href: 'profile.html' },
    ],
    admin: [
      { icon: 'fa-solid fa-gauge-high',  label: 'Overview',  href: 'admin-dashboard.html' },
      { icon: 'fa-solid fa-building',    label: 'Stations',  href: 'admin-dashboard.html#stations' },
      { icon: 'fa-solid fa-tags',        label: 'Prices',    href: 'admin-dashboard.html#prices',    special: true },
      { icon: 'fa-solid fa-users',       label: 'Staff',     href: 'admin-dashboard.html#employees' },
      { icon: 'fa-solid fa-chart-line',  label: 'Reports',   href: 'admin-dashboard.html#reports' },
    ],
  };

  const items   = configs[role] || configs.customer;
  const current = window.location.pathname.split('/').pop();

  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.innerHTML = items.filter(i => !i.sidebarOnly).map(item => `
      <a href="${item.href}" class="nav-item ${item.special ? 'pay-btn' : ''} ${current === item.href.split('#')[0] ? 'active' : ''}">
        <div class="nav-icon-wrap"><i class="${item.icon}"></i></div>
        <span class="nav-label">${item.label}</span>
      </a>`).join('');
  }

  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.innerHTML = items.map(item => `
      <a href="${item.href}" class="sidebar-link ${current === item.href.split('#')[0] ? 'active' : ''}">
        <i class="${item.icon} link-icon"></i>
        <span>${item.label}</span>
      </a>`).join('');
  }
}

// ─── Build User Info ───
function buildUserInfo() {
  const user = getCurrentUser();
  if (!user) return;
  const nameEl   = document.getElementById('user-name');
  const roleEl   = document.getElementById('user-role');
  const avatarEl = document.getElementById('user-avatar');
  const initials = (user.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  if (nameEl)   nameEl.textContent   = user.full_name || '';
  if (roleEl)   roleEl.textContent   = (user.role||'').charAt(0).toUpperCase() + (user.role||'').slice(1);
  if (avatarEl) {
    if (user.avatar_url) {
      avatarEl.innerHTML = `<img src="${user.avatar_url}" alt="${initials}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
    } else {
      avatarEl.textContent = initials;
    }
    // Make avatar clickable for photo upload
    avatarEl.title = 'Click to change photo';
    avatarEl.style.cursor = 'pointer';
    avatarEl.style.position = 'relative';
    avatarEl.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const result = await API.upload.avatar(file);
          // Update local user object
          const currentUser = getCurrentUser();
          if (currentUser) {
            currentUser.avatar_url = result.avatar_url;
            setUser(currentUser);
          }
          avatarEl.innerHTML = `<img src="${result.avatar_url}" alt="${initials}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
          if (typeof showToast === 'function') showToast('Profile photo updated!', 'success');
        } catch (err) {
          if (typeof showToast === 'function') showToast('Upload failed: ' + err.message, 'danger');
        }
      };
      input.click();
    };
  }
}

// ─── Animated Counter ───
function animateCounter(el, target, duration = 1400, prefix = '', suffix = '') {
  const start = performance.now();
  const step  = (now) => {
    const prog = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - prog, 3);
    el.textContent = prefix + Math.floor(ease * target).toLocaleString() + suffix;
    if (prog < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ─── Intersection Observer ───
function observeAnimations() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('animate-slide-up'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.observe-animate').forEach(el => obs.observe(el));
}

// ─── CSV Export ───
function exportCSV(data, filename = 'fuelgo-export.csv') {
  if (!data.length) return showToast('No data to export', 'warning');
  const csv = [Object.keys(data[0]).join(','), ...data.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: filename });
  a.click();
  showToast('Export started', 'success');
}

// ─── Particles ───
function createParticles(container, count = 12) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `left:${Math.random()*100}%;width:${4+Math.random()*6}px;height:${4+Math.random()*6}px;--duration:${6+Math.random()*8}s;--delay:${Math.random()*6}s;--drift:${(Math.random()-0.5)*200}px;opacity:${0.3+Math.random()*0.4}`;
    container.appendChild(p);
  }
}

// ─── Misc ───
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// ─── Global Quick Search ─────────────────────────
function initGlobalSearch() {
  const overlay = document.createElement('div');
  overlay.id = 'global-search-overlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);align-items:flex-start;justify-content:center;padding:80px 20px 20px';
  overlay.innerHTML = `
    <div style="width:100%;max-width:560px;background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-xl);overflow:hidden;animation:scaleIn 0.2s ease both">
      <div class="search-bar" style="border-radius:var(--radius-lg) var(--radius-lg) 0 0;border-bottom:1px solid var(--border);padding:4px 0">
        <span class="search-icon" style="padding-left:20px"><i class="fa-solid fa-magnifying-glass"></i></span>
        <input type="text" id="gs-input" aria-label="Search stations, transactions, vehicles" placeholder="Search stations, transactions, vehicles…" style="font-size:1rem;padding:14px 0;border:none;outline:none;background:transparent;flex:1;color:var(--text-primary)">
        <span style="padding-right:16px;font-size:0.78rem;color:var(--text-secondary)">ESC to close</span>
      </div>
      <div id="gs-results" style="max-height:400px;overflow-y:auto;padding:8px"></div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  document.body.appendChild(overlay);

  document.getElementById('gs-input').addEventListener('input', debounceSearch);
  document.addEventListener('keydown', e => {
    if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault(); openSearch();
    }
    if (e.key === 'Escape') closeSearch();
  });
}

let _searchTimer;
function debounceSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(runGlobalSearch, 280);
}

function openSearch() {
  const o = document.getElementById('global-search-overlay');
  if (!o) return;
  o.style.display = 'flex';
  setTimeout(() => document.getElementById('gs-input')?.focus(), 50);
}
function closeSearch() {
  const o = document.getElementById('global-search-overlay');
  if (o) { o.style.display = 'none'; document.getElementById('gs-input').value = ''; document.getElementById('gs-results').innerHTML = ''; }
}

async function runGlobalSearch() {
  const q = document.getElementById('gs-input')?.value?.toLowerCase().trim();
  const el = document.getElementById('gs-results');
  if (!q || q.length < 2) { el.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:24px;font-size:0.9rem">Type at least 2 characters…</p>'; return; }
  el.innerHTML = '<p style="text-align:center;padding:20px"><span class="spinner" style="display:inline-block"></span></p>';
  try {
    const [txns, stations, vehicles] = await Promise.all([
      API.transactions.getAll().catch(() => []),
      API.stations.getAll().catch(() => []),
      API.vehicles.getAll().catch(() => []),
    ]);
    const results = [];
    stations.filter(s => s.station_name.toLowerCase().includes(q) || (s.location||'').toLowerCase().includes(q))
      .slice(0,3).forEach(s => results.push({ type:'station', icon:'fa-solid fa-gas-pump', title:s.station_name, sub:`${s.location} · ${s.is_open?'Open':'Closed'}`, href:`pump.html?station=${s.station_id}` }));
    vehicles.filter(v => (v.plate_number||'').toLowerCase().includes(q) || (v.make||'').toLowerCase().includes(q) || (v.model||'').toLowerCase().includes(q))
      .slice(0,3).forEach(v => results.push({ type:'vehicle', icon:'fa-solid fa-car', title:v.plate_number, sub:`${v.make||''} ${v.model||''} · ${v.fuel_name||''}`, href:'vehicles.html' }));
    txns.filter(t => (t.station_name||'').toLowerCase().includes(q) || (t.fuel_name||'').toLowerCase().includes(q))
      .slice(0,4).forEach(t => results.push({ type:'txn', icon:'fa-solid fa-receipt', title:t.station_name||'Transaction', sub:`${formatDate(t.transaction_date)} · ${formatCurrency(t.total_amount)}`, href:`receipt.html?txn=${t.transaction_id}` }));
    el.innerHTML = results.length
      ? results.map(r => `<a href="${r.href}" onclick="closeSearch()" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:var(--radius-sm);text-decoration:none;transition:background var(--transition)" onmouseover="this.style.background='var(--surface-alt)'" onmouseout="this.style.background=''">`
          + `<div style="width:36px;height:36px;border-radius:var(--radius-xs);background:rgba(249,115,22,0.1);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:16px;flex-shrink:0"><i class="${r.icon}"></i></div>`
          + `<div><div style="font-weight:600;font-size:0.9rem;color:var(--text-primary)">${r.title}</div><div style="font-size:0.78rem;color:var(--text-secondary)">${r.sub}</div></div>`
          + `<i class="fa-solid fa-arrow-right" style="margin-left:auto;color:var(--text-secondary);font-size:12px"></i></a>`).join('')
      : '<p style="text-align:center;color:var(--text-secondary);padding:24px;font-size:0.9rem">No results found</p>';
  } catch { el.innerHTML = '<p style="text-align:center;color:var(--danger);padding:24px;font-size:0.9rem">Search failed</p>'; }
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ─── PWA Install Banner ───────────────────────────
let _pwaPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  const dismissed = localStorage.getItem('fuelgo_pwa_dismissed');
  if (!dismissed) setTimeout(_showInstallBanner, 3000);
});

function _showInstallBanner() {
  if (!_pwaPrompt || document.getElementById('pwa-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-banner';
  banner.style.cssText = 'position:fixed;bottom:76px;left:50%;transform:translateX(-50%);z-index:9998;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);padding:14px 18px;display:flex;align-items:center;gap:14px;max-width:360px;width:calc(100% - 32px);animation:slideUp 0.4s ease both';
  banner.innerHTML = `
    <div style="width:40px;height:40px;background:var(--gradient-accent);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">⛽</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:0.9rem">Install FuelGO</div>
      <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px">Add to home screen for quick access</div>
    </div>
    <button id="pwa-install-btn" style="background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);padding:8px 14px;font-weight:700;font-size:0.82rem;cursor:pointer;flex-shrink:0">Install</button>
    <button id="pwa-dismiss-btn" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:4px;font-size:18px;flex-shrink:0">×</button>`;
  document.body.appendChild(banner);
  document.getElementById('pwa-install-btn').onclick = async () => {
    _pwaPrompt.prompt();
    const { outcome } = await _pwaPrompt.userChoice;
    banner.remove();
    if (outcome === 'accepted') showToast('FuelGO installed!', 'success');
    _pwaPrompt = null;
  };
  document.getElementById('pwa-dismiss-btn').onclick = () => {
    banner.remove();
    localStorage.setItem('fuelgo_pwa_dismissed', '1');
  };
}

function initInstallBanner() {
  // Banner is shown via beforeinstallprompt event
}

// ─── Offline Detection Banner ────────────────────────
function initOfflineDetection() {
  let offlineBanner = null;
  let onlineMsgTimeout = null;

  function showBanner(isOnline) {
    if (offlineBanner) offlineBanner.remove();
    if (onlineMsgTimeout) clearTimeout(onlineMsgTimeout);

    offlineBanner = document.createElement('div');
    offlineBanner.className = 'offline-banner' + (isOnline ? ' online-mode' : '');
    offlineBanner.innerHTML = isOnline
      ? `<div class="ob-icon"><i class="fa-solid fa-wifi"></i></div>
         <div class="ob-text">
           <div>Back online</div>
           <div class="ob-sub">All features restored</div>
         </div>
         <button class="ob-close" onclick="this.closest('.offline-banner').remove()">×</button>`
      : `<div class="ob-icon"><i class="fa-solid fa-wifi-slash"></i></div>
         <div class="ob-text">
           <div>No internet connection</div>
           <div class="ob-sub">Some features may be unavailable</div>
         </div>
         <button class="ob-close" onclick="this.closest('.offline-banner').remove()">×</button>`;
    document.body.appendChild(offlineBanner);

    if (isOnline) {
      onlineMsgTimeout = setTimeout(() => { if (offlineBanner) { offlineBanner.remove(); offlineBanner = null; } }, 3500);
    }
  }

  window.addEventListener('offline', () => showBanner(false));
  window.addEventListener('online',  () => showBanner(true));

  // Show banner immediately if already offline
  if (!navigator.onLine) showBanner(false);
}

// ─── Back to Top Button ──────────────────────────────
function initBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
  btn.title = 'Back to top';
  btn.setAttribute('aria-label', 'Scroll back to top');
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(btn);

  const mainContent = document.querySelector('.main-content') || window;
  const scrollTarget = document.querySelector('.stations-panel') || mainContent;

  function onScroll() {
    const scrollY = scrollTarget === window ? window.scrollY : scrollTarget.scrollTop;
    btn.classList.toggle('visible', scrollY > 320);
  }
  if (scrollTarget === window) {
    window.addEventListener('scroll', onScroll, { passive: true });
  } else {
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
  }
  window.addEventListener('scroll', onScroll, { passive: true }); // fallback
}

// ─── Session Timeout Warning ─────────────────────────
function initSessionTimeout() {
  const token = localStorage.getItem('fuelgo_token');
  if (!token) return;

  // Decode JWT payload (base64url → JSON)
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return;

    const expiresAt   = payload.exp * 1000; // ms
    const warningAt   = expiresAt - 2 * 60 * 1000; // 2 min before expiry
    const now         = Date.now();

    if (now >= expiresAt) return; // already expired, auth guard will redirect

    const warningIn = warningAt - now;
    const logoutIn  = expiresAt - now;

    if (warningIn > 0) {
      setTimeout(showSessionWarning, warningIn);
    } else if (warningIn <= 0 && logoutIn > 0) {
      // Already in the warning window
      showSessionWarning();
    }

    if (logoutIn > 0) {
      setTimeout(() => {
        if (typeof notify === 'function') notify('warning', 'Session expired', 'Redirecting to login…', 3000);
        setTimeout(() => API.auth.logout(), 3000);
      }, logoutIn);
    }
  } catch { /* JWT decode failed — non-critical */ }
}

function showSessionWarning() {
  if (document.getElementById('session-warning')) return; // already shown
  const warn = document.createElement('div');
  warn.id = 'session-warning';
  warn.className = 'session-warning show';
  warn.innerHTML = `
    <div class="session-warning-title">
      <i class="fa-solid fa-triangle-exclamation"></i> Session expiring
    </div>
    <div class="session-warning-body">Your session will expire in about 2 minutes. Stay logged in?</div>
    <div class="session-warning-actions">
      <button class="btn btn-accent btn-sm" onclick="extendSession()" style="flex:1">Stay Logged In</button>
      <button class="btn btn-ghost btn-sm" onclick="this.closest('#session-warning').remove()">Dismiss</button>
    </div>`;
  document.body.appendChild(warn);
}

async function extendSession() {
  try {
    const data = await API.auth.me();
    if (data) {
      const warn = document.getElementById('session-warning');
      if (warn) warn.remove();
      showToast('Session extended successfully', 'success');
      initSessionTimeout(); // re-schedule
    }
  } catch {
    showToast('Could not extend session — please log in again', 'danger');
  }
}

// ─── Init App Frame ───
function initAppFrame(role) {
  initTheme();
  const user = requireAuth(role ? [role] : []);
  if (!user) return null;
  buildNav(user.role);
  buildUserInfo();
  document.querySelectorAll('.btn').forEach(addRipple);
  document.querySelectorAll('[data-logout]').forEach(el => el.addEventListener('click', () => API.auth.logout()));
  observeAnimations();
  // Dark mode toggle injected into sidebar user section
  const sidebarUser = document.querySelector('.sidebar-user');
  if (sidebarUser && !document.getElementById('theme-toggle-btn')) {
    const btn = document.createElement('button');
    btn.id = 'theme-toggle-btn';
    btn.className = 'theme-toggle-btn';
    btn.title = 'Toggle dark mode (D)';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    btn.onclick = () => applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
    sidebarUser.insertBefore(btn, sidebarUser.querySelector('.sidebar-logout'));
  }
  // Keyboard shortcut: D = toggle dark mode
  document.addEventListener('keydown', e => {
    if (e.key === 'd' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !e.ctrlKey && !e.metaKey) {
      applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
    }
  });
  // PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  // PWA install banner
  initInstallBanner();
  // Global search
  initGlobalSearch();
  // New global features
  initOfflineDetection();
  initBackToTop();
  initSessionTimeout();
  return user;
}

// ─── Expose globals ───
Object.assign(window, {
  getCurrentUser, requireAuth, redirectIfLoggedIn,
  showToast, openModal, closeModal, closeModalOnOverlay,
  setLoading, setBtnLoading,
  validateEmail, validatePhone, validatePassword, setFieldState,
  formatDate, formatDateTime, formatCurrency, formatLitres, formatPoints,
  addRipple, buildNav, buildUserInfo, animateCounter,
  exportCSV, createParticles, getGreeting, initAppFrame,
  applyTheme, initTheme, openSearch, closeSearch,
  extendSession, showSessionWarning,
  initOfflineDetection, initBackToTop, initSessionTimeout,
});
