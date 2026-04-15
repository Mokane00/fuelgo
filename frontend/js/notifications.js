// ================================================
// FuelGO — notifications.js  v2.0
// Revolutionary notification system:
//  • Glassmorphism toast stack (max 4, oldest fades first)
//  • Animated notification bell + unread badge
//  • Slide-in notification centre drawer
//  • Rich toasts: action buttons, category, auto-pause on hover
//  • Progress / persistent toasts
//  • Swipe-to-dismiss on mobile
//  • Sound effects (Web Audio, toggleable)
//  • localStorage history (last 100)
//  • Category filtering: transaction | alert | loyalty | promo | system
//  • Dark-mode aware
// ================================================
(function () {
  'use strict';

  // ─── Type config ─────────────────────────────────────
  const TYPES = {
    success: { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  icon: '✓' },
    error:   { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  icon: '✕' },
    warning: { color: '#F97316', bg: 'rgba(249,115,22,0.12)', icon: '!' },
    info:    { color: '#1A3C6E', bg: 'rgba(26,60,110,0.12)',  icon: 'i' },
    promo:   { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', icon: '★' },
    loyalty: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: '◆' },
  };

  // ─── State ───────────────────────────────────────────
  const MAX_TOASTS   = 4;
  const MAX_HISTORY  = 100;
  const STORE_KEY    = 'fg_notifications_v2';
  const SETTINGS_KEY = 'fg_notif_settings';

  let activeToasts = [];
  let unreadCount  = 0;
  let centerOpen   = false;
  let activeFilter = 'all';

  // ─── Settings ────────────────────────────────────────
  function getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
  }
  function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  // ─── History ─────────────────────────────────────────
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }
  function saveHistory(h) { localStorage.setItem(STORE_KEY, JSON.stringify(h.slice(0, MAX_HISTORY))); }
  function addToHistory(item) {
    const h = loadHistory();
    h.unshift(item);
    saveHistory(h);
    unreadCount++;
    updateBadge();
  }

  // ─── Inject CSS ───────────────────────────────────────
  if (!document.getElementById('fg-notif-css')) {
    const st = document.createElement('style');
    st.id = 'fg-notif-css';
    st.textContent = `
/* ── Toast Container ─────────────────────────── */
#fg-toast-wrap {
  position: fixed; top: 20px; right: 20px; z-index: 999999;
  display: flex; flex-direction: column; gap: 10px;
  pointer-events: none;
  max-width: 380px; width: calc(100vw - 40px);
}

/* ── Toast ───────────────────────────────────── */
.fg-t {
  pointer-events: all; position: relative; overflow: hidden;
  background: rgba(255,255,255,0.97);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.75);
  box-shadow: 0 8px 40px rgba(0,0,0,0.14), 0 2px 10px rgba(0,0,0,0.07),
              inset 0 1px 0 rgba(255,255,255,0.9);
  animation: fgTIn 0.42s cubic-bezier(0.175,0.885,0.32,1.275) both;
  transform-origin: top right;
  user-select: none; touch-action: pan-y;
  transition: box-shadow 0.2s, transform 0.2s;
}
.fg-t:hover { box-shadow: 0 12px 50px rgba(0,0,0,0.18), 0 3px 14px rgba(0,0,0,0.1); }
.fg-t.fg-closing { animation: fgTOut 0.32s ease forwards !important; }
.fg-t.fg-paused .fg-tpbar { animation-play-state: paused !important; }

/* left colour strip */
.fg-t::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 4px; border-radius: 16px 0 0 16px;
  background: var(--fgt-c, #1A3C6E);
}

/* ── Toast inner ─────────────────────────────── */
.fg-ti { display: flex; align-items: flex-start; gap: 12px; padding: 14px 40px 10px 18px; }

.fg-tic {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 900; font-family: system-ui, sans-serif;
  background: var(--fgt-bg, rgba(26,60,110,0.1));
  color: var(--fgt-c, #1A3C6E);
}

.fg-tb  { flex: 1; min-width: 0; }
.fg-tbt { font-size: 0.88rem; font-weight: 700; color: #0F172A; line-height: 1.3; margin-bottom: 3px; }
.fg-tbm { font-size: 0.8rem;  color: #64748B; line-height: 1.4; }
.fg-tts { font-size: 0.68rem; color: #94A3B8; margin-top: 4px; display: flex; align-items: center; gap: 4px; }

/* ── Action buttons ──────────────────────────── */
.fg-tact { display: flex; gap: 8px; padding: 0 18px 12px 66px; flex-wrap: wrap; }
.fg-tact-btn {
  padding: 5px 14px; border-radius: 7px; border: none;
  font-size: 0.75rem; font-weight: 600; cursor: pointer;
  transition: filter 0.15s, transform 0.15s; line-height: 1.3;
}
.fg-tact-btn.primary { background: var(--fgt-c, #1A3C6E); color: #fff; }
.fg-tact-btn.primary:hover { filter: brightness(1.15); transform: translateY(-1px); }
.fg-tact-btn.ghost { background: rgba(0,0,0,0.06); color: #374151; }
.fg-tact-btn.ghost:hover { background: rgba(0,0,0,0.1); }

/* ── Close button ────────────────────────────── */
.fg-tcls {
  position: absolute; top: 10px; right: 12px;
  width: 24px; height: 24px; border-radius: 6px; border: none;
  background: none; cursor: pointer; pointer-events: all;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: #94A3B8; transition: all 0.15s;
}
.fg-tcls:hover { background: rgba(0,0,0,0.08); color: #374151; }

/* ── Progress bar ────────────────────────────── */
.fg-tpbar-wrap { height: 3px; background: rgba(0,0,0,0.05); overflow: hidden; }
.fg-tpbar {
  height: 100%; background: var(--fgt-c, #1A3C6E);
  animation: fgProg linear forwards; transform-origin: left; opacity: 0.55;
}

/* ── Progress spinner (indeterminate) ────────── */
.fg-prog-slide {
  height: 100%;
  background: linear-gradient(90deg, transparent 0%, var(--fgt-c,#1A3C6E) 40%, var(--fgt-c,#1A3C6E) 60%, transparent 100%);
  background-size: 200% 100%;
  animation: fgProgSlide 1.4s ease-in-out infinite;
  opacity: 0.6;
}

/* ── Animations ──────────────────────────────── */
@keyframes fgTIn  {
  from { transform: translateX(calc(100% + 24px)) scale(0.88); opacity: 0; }
  to   { transform: translateX(0) scale(1); opacity: 1; }
}
@keyframes fgTOut {
  0%  { transform: translateX(0) scale(1); opacity: 1; max-height: 180px; }
  55% { transform: translateX(calc(100% + 24px)); opacity: 0; max-height: 180px; }
  100%{ max-height: 0; padding: 0; margin: 0; opacity: 0; }
}
@keyframes fgProg { from { width: 100%; } to { width: 0; } }
@keyframes fgProgSlide { 0%{background-position:150% 0} 100%{background-position:-150% 0} }
@keyframes fgSpinI { to { transform: rotate(360deg); } }

/* ── Dark mode (toasts) ──────────────────────── */
[data-theme="dark"] .fg-t {
  background: rgba(15,23,42,0.95);
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07);
}
[data-theme="dark"] .fg-tbt { color: #F1F5F9; }
[data-theme="dark"] .fg-tbm { color: #94A3B8; }
[data-theme="dark"] .fg-tcls:hover { background: rgba(255,255,255,0.1); color: #F1F5F9; }
[data-theme="dark"] .fg-tact-btn.ghost { background: rgba(255,255,255,0.09); color: #CBD5E1; }

/* ── Notification Bell ───────────────────────── */
#fg-notif-bell {
  position: relative; flex-shrink: 0;
  width: 38px; height: 38px; border-radius: 10px; border: none;
  background: var(--surface-alt, #F1F5F9);
  border: 1px solid var(--border, #E2E8F0);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.22s; color: var(--text-secondary, #64748B);
}
#fg-notif-bell:hover {
  background: var(--surface, #fff);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  color: var(--primary, #1A3C6E);
  transform: translateY(-1px);
}
#fg-notif-bell.ringing { animation: fgBellRing 0.65s ease both; }

#fg-notif-badge {
  position: absolute; top: -5px; right: -5px;
  min-width: 18px; height: 18px; border-radius: 9999px;
  background: #EF4444; color: #fff;
  font-size: 0.6rem; font-weight: 800; line-height: 1;
  display: none; align-items: center; justify-content: center;
  padding: 0 3px;
  border: 2px solid var(--surface, #fff);
  animation: fgBadgePop 0.35s cubic-bezier(0.175,0.885,0.32,1.275) both;
}
#fg-notif-badge.visible { display: flex; }

/* Mobile fixed bell */
#fg-mobile-bell-btn {
  position: fixed; top: 14px; right: 14px; z-index: 9000;
  width: 40px; height: 40px; border-radius: 12px; border: none;
  background: var(--surface, #fff);
  box-shadow: 0 4px 20px rgba(0,0,0,0.13);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-secondary, #64748B);
  transition: all 0.2s;
}
#fg-mobile-bell-btn:hover { color: var(--primary, #1A3C6E); transform: translateY(-1px); }
#fg-mobile-bell-badge {
  position: absolute; top: -3px; right: -3px;
  min-width: 16px; height: 16px; border-radius: 9999px;
  background: #EF4444; color: #fff;
  font-size: 0.58rem; font-weight: 800; line-height: 1;
  display: none; align-items: center; justify-content: center;
  padding: 0 2px; border: 2px solid var(--surface, #fff);
}
#fg-mobile-bell-badge.visible { display: flex; }
@media (min-width: 768px) { #fg-mobile-bell-btn { display: none !important; } }
@media (max-width: 767px) { #fg-notif-bell { display: none !important; } }

@keyframes fgBellRing {
  0%,100% { transform: rotate(0deg); }
  15%     { transform: rotate(14deg); }
  30%     { transform: rotate(-11deg); }
  45%     { transform: rotate(8deg); }
  60%     { transform: rotate(-6deg); }
  75%     { transform: rotate(3deg); }
}
@keyframes fgBadgePop {
  from { transform: scale(0); opacity: 0; }
  65%  { transform: scale(1.35); }
  to   { transform: scale(1);    opacity: 1; }
}

/* ── Notification Centre ─────────────────────── */
#fg-nc {
  position: fixed; top: 0; right: -440px;
  width: 420px; max-width: 100vw; height: 100dvh;
  background: var(--surface, #fff);
  border-left: 1px solid var(--border, #E2E8F0);
  box-shadow: -14px 0 60px rgba(0,0,0,0.17);
  z-index: 99998; display: flex; flex-direction: column;
  overflow: hidden;
  transition: right 0.38s cubic-bezier(0.23,1,0.32,1);
}
#fg-nc.open { right: 0; }
#fg-nc-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.32); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
  z-index: 99997; opacity: 0; visibility: hidden;
  transition: all 0.38s;
}
#fg-nc-overlay.open { opacity: 1; visibility: visible; }

.fg-nch { padding: 20px 20px 0; border-bottom: 1px solid var(--border, #E2E8F0); flex-shrink: 0; }
.fg-nch-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.fg-nch-title {
  font-family: 'Syne', sans-serif; font-size: 1.08rem; font-weight: 800;
  color: var(--text-primary, #0F172A); flex: 1;
}
.fg-nch-mark {
  font-size: 0.73rem; font-weight: 600; color: var(--primary, #1A3C6E);
  background: none; border: none; cursor: pointer;
  padding: 4px 8px; border-radius: 6px; transition: background 0.15s;
}
.fg-nch-mark:hover { background: rgba(26,60,110,0.08); }
.fg-nch-close {
  width: 30px; height: 30px; border-radius: 8px; border: none;
  background: var(--surface-alt, #F1F5F9); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary, #64748B); transition: all 0.18s;
}
.fg-nch-close:hover { background: var(--border, #E2E8F0); color: var(--text-primary, #0F172A); }

/* Filter tabs */
.fg-nc-tabs {
  display: flex; gap: 6px; padding: 0 0 12px;
  overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.fg-nc-tabs::-webkit-scrollbar { display: none; }
.fg-nc-tab {
  padding: 5px 12px; border-radius: 20px; white-space: nowrap; cursor: pointer;
  font-size: 0.73rem; font-weight: 600; border: 1.5px solid var(--border, #E2E8F0);
  background: transparent; color: var(--text-secondary, #64748B); transition: all 0.2s;
}
.fg-nc-tab.active {
  background: var(--primary, #1A3C6E);
  border-color: var(--primary, #1A3C6E); color: #fff;
}

/* List */
#fg-nc-list { flex: 1; overflow-y: auto; padding: 4px 0; scroll-behavior: smooth; }
#fg-nc-list::-webkit-scrollbar { width: 4px; }
#fg-nc-list::-webkit-scrollbar-thumb { background: var(--border, #E2E8F0); border-radius: 2px; }

.fg-ni {
  display: flex; gap: 12px; padding: 13px 20px;
  cursor: pointer; transition: background 0.18s; position: relative;
  border-bottom: 1px solid var(--border, #E2E8F0);
  animation: fgTIn 0.3s ease both;
}
.fg-ni:last-child { border-bottom: none; }
.fg-ni:hover { background: var(--surface-alt, #F1F5F9); }
.fg-ni.unread { background: rgba(26,60,110,0.04); }
.fg-ni.unread::before {
  content: ''; position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
  width: 5px; height: 5px; border-radius: 50%; background: var(--primary, #1A3C6E);
}
.fg-ni-icon {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 900;
}
.fg-ni-body { flex: 1; min-width: 0; }
.fg-ni-ttl  { font-size: 0.84rem; font-weight: 600; color: var(--text-primary, #0F172A); margin-bottom: 2px; line-height: 1.3; }
.fg-ni-msg  { font-size: 0.77rem; color: var(--text-secondary, #64748B); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fg-ni-time { font-size: 0.67rem; color: #94A3B8; margin-top: 3px; }

/* Empty */
.fg-nc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 56px 20px; text-align: center; }
.fg-nc-empty-icon  { font-size: 44px; opacity: 0.25; margin-bottom: 14px; }
.fg-nc-empty-title { font-weight: 700; font-size: 0.98rem; color: var(--text-primary, #0F172A); margin-bottom: 5px; }
.fg-nc-empty-sub   { font-size: 0.8rem; color: var(--text-secondary, #64748B); }

/* Footer */
.fg-nc-foot {
  padding: 11px 20px; border-top: 1px solid var(--border, #E2E8F0);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0; gap: 8px;
}
.fg-nc-sound {
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; cursor: pointer;
  font-size: 0.73rem; color: var(--text-secondary, #64748B);
  padding: 5px 8px; border-radius: 6px; transition: all 0.18s;
}
.fg-nc-sound:hover { background: var(--surface-alt, #F1F5F9); color: var(--text-primary, #0F172A); }
.fg-nc-clear {
  background: none; border: none; cursor: pointer;
  font-size: 0.73rem; color: var(--danger, #EF4444);
  padding: 5px 8px; border-radius: 6px; transition: all 0.18s;
}
.fg-nc-clear:hover { background: var(--danger-bg, #FEF2F2); }

/* Dark mode – centre */
[data-theme="dark"] #fg-nc { background: #0F172A; border-left-color: rgba(255,255,255,0.07); }
[data-theme="dark"] .fg-nch { border-bottom-color: rgba(255,255,255,0.07); }
[data-theme="dark"] .fg-nch-title { color: #F1F5F9; }
[data-theme="dark"] .fg-nc-tab { border-color: rgba(255,255,255,0.12); color: #94A3B8; }
[data-theme="dark"] .fg-ni { border-bottom-color: rgba(255,255,255,0.06); }
[data-theme="dark"] .fg-ni:hover  { background: rgba(255,255,255,0.05); }
[data-theme="dark"] .fg-ni.unread { background: rgba(26,60,110,0.18); }
[data-theme="dark"] .fg-ni-ttl   { color: #F1F5F9; }
[data-theme="dark"] .fg-nch-close { background: rgba(255,255,255,0.07); }
[data-theme="dark"] #fg-nc-overlay { background: rgba(0,0,0,0.55); }
[data-theme="dark"] #fg-notif-bell { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.1); }
[data-theme="dark"] #fg-notif-badge { border-color: #0F172A; }
[data-theme="dark"] #fg-mobile-bell-btn { background: #1E293B; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
[data-theme="dark"] #fg-mobile-bell-badge { border-color: #1E293B; }

/* Mobile */
@media (max-width: 480px) {
  #fg-nc { width: 100vw; }
  #fg-toast-wrap { top: 60px; right: 10px; width: calc(100vw - 20px); max-width: 100vw; }
  .fg-t { border-radius: 12px; }
}
    `;
    document.head.appendChild(st);
  }

  // ─── Toast container ──────────────────────────────────
  function getWrap() {
    let w = document.getElementById('fg-toast-wrap');
    if (!w) { w = document.createElement('div'); w.id = 'fg-toast-wrap'; document.body.appendChild(w); }
    return w;
  }

  // ─── Time helper ─────────────────────────────────────
  function timeAgo(ts) {
    const d = Date.now() - ts;
    if (d < 60000)    return 'Just now';
    if (d < 3600000)  return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  // ─── Badge ───────────────────────────────────────────
  function updateBadge() {
    [document.getElementById('fg-notif-badge'), document.getElementById('fg-mobile-bell-badge')]
      .forEach(b => {
        if (!b) return;
        if (unreadCount > 0) {
          b.textContent = unreadCount > 99 ? '99+' : unreadCount;
          b.classList.add('visible');
        } else {
          b.classList.remove('visible');
        }
      });
  }

  // ─── Bell injection ───────────────────────────────────
  function injectBells() {
    // Desktop bell – goes inside .sidebar-user before the logout button
    if (!document.getElementById('fg-notif-bell')) {
      const sidebar = document.querySelector('.sidebar-user');
      if (sidebar) {
        const h = loadHistory();
        unreadCount = h.filter(n => !n.read).length;
        const bell = document.createElement('button');
        bell.id = 'fg-notif-bell';
        bell.setAttribute('aria-label', 'Notifications');
        bell.title = 'Notifications';
        bell.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span id="fg-notif-badge">${unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : ''}</span>`;
        if (unreadCount > 0) bell.querySelector('#fg-notif-badge').classList.add('visible');
        bell.addEventListener('click', openCenter);
        const logoutBtn = sidebar.querySelector('[data-logout], .sidebar-logout');
        sidebar.insertBefore(bell, logoutBtn || null);
      }
    }

    // Mobile bell – fixed top-right button
    if (!document.getElementById('fg-mobile-bell-btn')) {
      const btn = document.createElement('button');
      btn.id = 'fg-mobile-bell-btn';
      btn.setAttribute('aria-label', 'Notifications');
      btn.title = 'Notifications';
      const cnt = unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : '';
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span id="fg-mobile-bell-badge" ${unreadCount > 0 ? 'class="visible"' : ''}>${cnt}</span>`;
      btn.addEventListener('click', openCenter);
      document.body.appendChild(btn);
    }
  }

  // ─── Build the notification centre ───────────────────
  function buildCenter() {
    if (document.getElementById('fg-nc')) return;

    const overlay = document.createElement('div');
    overlay.id = 'fg-nc-overlay';
    overlay.addEventListener('click', closeCenter);
    document.body.appendChild(overlay);

    const nc = document.createElement('div');
    nc.id = 'fg-nc';
    nc.innerHTML = `
      <div class="fg-nch">
        <div class="fg-nch-row">
          <div class="fg-nch-title">🔔 Notifications</div>
          <button class="fg-nch-mark" id="fg-mark-all-btn">Mark all read</button>
          <button class="fg-nch-close" id="fg-nc-close-btn" aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="fg-nc-tabs" id="fg-nc-tabs">
          <button class="fg-nc-tab active" data-f="all">All</button>
          <button class="fg-nc-tab" data-f="transaction">💳 Transactions</button>
          <button class="fg-nc-tab" data-f="alert">🔔 Alerts</button>
          <button class="fg-nc-tab" data-f="loyalty">⭐ Loyalty</button>
          <button class="fg-nc-tab" data-f="promo">🎁 Promos</button>
          <button class="fg-nc-tab" data-f="system">⚙️ System</button>
        </div>
      </div>
      <div id="fg-nc-list"></div>
      <div class="fg-nc-foot">
        <button class="fg-nc-sound" id="fg-sound-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          <span id="fg-sound-label">Sound on</span>
        </button>
        <button class="fg-nc-clear" id="fg-nc-clear-btn">Clear all</button>
      </div>`;
    document.body.appendChild(nc);

    // Wire up events
    nc.querySelector('#fg-nc-close-btn').addEventListener('click', closeCenter);
    nc.querySelector('#fg-mark-all-btn').addEventListener('click', markAllRead);
    nc.querySelector('#fg-sound-btn').addEventListener('click', toggleSound);
    nc.querySelector('#fg-nc-clear-btn').addEventListener('click', clearAll);

    // Tab clicks (event delegation)
    nc.querySelector('#fg-nc-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.fg-nc-tab');
      if (tab) setFilter(tab.dataset.f);
    });

    // Item clicks (event delegation)
    nc.querySelector('#fg-nc-list').addEventListener('click', e => {
      const item = e.target.closest('.fg-ni');
      if (item) readItem(item.dataset.id);
    });

    // Keyboard close
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && centerOpen) closeCenter(); });
  }

  // ─── Render list ─────────────────────────────────────
  function renderList() {
    const el = document.getElementById('fg-nc-list');
    if (!el) return;
    const history  = loadHistory();
    const filtered = activeFilter === 'all' ? history : history.filter(n => n.category === activeFilter);

    if (!filtered.length) {
      el.innerHTML = `<div class="fg-nc-empty">
        <div class="fg-nc-empty-icon">🔕</div>
        <div class="fg-nc-empty-title">No notifications</div>
        <div class="fg-nc-empty-sub">${activeFilter === 'all' ? "You're all caught up!" : `No ${activeFilter} notifications yet`}</div>
      </div>`;
      return;
    }

    el.innerHTML = filtered.map(n => {
      const t = TYPES[n.type] || TYPES.info;
      return `<div class="fg-ni ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <div class="fg-ni-icon" style="background:${t.bg};color:${t.color}">${t.icon}</div>
        <div class="fg-ni-body">
          <div class="fg-ni-ttl">${n.title || '&nbsp;'}</div>
          <div class="fg-ni-msg">${n.message}</div>
          <div class="fg-ni-time">${timeAgo(n.timestamp)}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Open / Close ─────────────────────────────────────
  function openCenter() {
    buildCenter();
    renderList();
    updateSoundBtn();
    document.getElementById('fg-nc').classList.add('open');
    document.getElementById('fg-nc-overlay').classList.add('open');
    centerOpen = true;
    ringBells();
  }

  function closeCenter() {
    const nc = document.getElementById('fg-nc');
    const ov = document.getElementById('fg-nc-overlay');
    if (nc) nc.classList.remove('open');
    if (ov) ov.classList.remove('open');
    centerOpen = false;
  }

  function ringBells() {
    [document.getElementById('fg-notif-bell'), document.getElementById('fg-mobile-bell-btn')]
      .forEach(b => {
        if (!b) return;
        b.classList.add('ringing');
        setTimeout(() => b.classList.remove('ringing'), 700);
      });
  }

  // ─── Actions ─────────────────────────────────────────
  function markAllRead() {
    saveHistory(loadHistory().map(n => ({ ...n, read: true })));
    unreadCount = 0;
    updateBadge();
    renderList();
  }

  function setFilter(f) {
    activeFilter = f;
    document.querySelectorAll('.fg-nc-tab').forEach(t => t.classList.toggle('active', t.dataset.f === f));
    renderList();
  }

  function readItem(id) {
    const h = loadHistory();
    const item = h.find(n => n.id === id);
    if (item && !item.read) {
      item.read = true;
      saveHistory(h);
      unreadCount = Math.max(0, unreadCount - 1);
      updateBadge();
      renderList();
    }
    if (item && item.href) window.location.href = item.href;
  }

  function clearAll() {
    saveHistory([]);
    unreadCount = 0;
    updateBadge();
    renderList();
  }

  // ─── Sound ───────────────────────────────────────────
  function playSound() {
    if (getSettings().soundOff) return;
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900,  ctx.currentTime);
      osc.frequency.setValueAtTime(1180, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      ctx.resume().then(() => { osc.start(); osc.stop(ctx.currentTime + 0.28); });
    } catch {}
  }

  function toggleSound() {
    const s = getSettings(); s.soundOff = !s.soundOff; saveSettings(s); updateSoundBtn();
  }

  function updateSoundBtn() {
    const settings = getSettings();
    const btn   = document.getElementById('fg-sound-btn');
    const label = document.getElementById('fg-sound-label');
    if (btn)   btn.style.opacity   = settings.soundOff ? '0.5' : '1';
    if (label) label.textContent   = settings.soundOff ? 'Sound off' : 'Sound on';
  }

  // ─── Swipe to dismiss ────────────────────────────────
  function addSwipe(toast) {
    let sx = 0, dx = 0;
    toast.addEventListener('touchstart', e => { sx = e.touches[0].clientX; toast.style.transition = 'none'; }, { passive: true });
    toast.addEventListener('touchmove',  e => {
      dx = e.touches[0].clientX - sx;
      if (dx > 0) { toast.style.transform = `translateX(${dx}px)`; toast.style.opacity = `${Math.max(0, 1 - dx / 180)}`; }
    }, { passive: true });
    toast.addEventListener('touchend', () => {
      toast.style.transition = '';
      if (dx > 75) dismissToast(toast); else { toast.style.transform = ''; toast.style.opacity = ''; }
      dx = 0;
    });
  }

  // ─── Dismiss toast ───────────────────────────────────
  function dismissToast(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.add('fg-closing');
    setTimeout(() => { toast.remove(); activeToasts = activeToasts.filter(t => t !== toast); }, 340);
  }

  // ════════════════════════════════════════════════════════
  //  MAIN  notify()
  // ════════════════════════════════════════════════════════
  /**
   * @param {string} type      'success' | 'error' | 'warning' | 'info' | 'promo' | 'loyalty'
   * @param {string} title     Bold headline
   * @param {string} message   Body text
   * @param {number} duration  Auto-dismiss ms  (0 = persistent)
   * @param {object} opts      { category, href, actions:[{label,fn,style}] }
   */
  window.notify = function (type = 'info', title = '', message = '', duration = 4500, opts = {}) {
    const conf = TYPES[type] || TYPES.info;
    const wrap = getWrap();

    // Trim excess toasts
    while (activeToasts.length >= MAX_TOASTS) dismissToast(activeToasts[0]);

    const id    = `fgt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const toast = document.createElement('div');
    toast.className = 'fg-t';
    toast.id = id;
    toast.style.cssText = `--fgt-c:${conf.color};--fgt-bg:${conf.bg}`;

    const actHTML = opts.actions
      ? `<div class="fg-tact">${opts.actions.map(a =>
          `<button class="fg-tact-btn ${a.style || 'primary'}" onclick="(${a.fn})()">${a.label}</button>`
        ).join('')}</div>` : '';

    const progHTML = duration > 0
      ? `<div class="fg-tpbar-wrap"><div class="fg-tpbar" style="animation-duration:${duration}ms"></div></div>`
      : '';

    toast.innerHTML = `
      <div class="fg-ti">
        <div class="fg-tic">${conf.icon}</div>
        <div class="fg-tb">
          ${title   ? `<div class="fg-tbt">${title}</div>`   : ''}
          ${message ? `<div class="fg-tbm">${message}</div>` : ''}
          <div class="fg-tts">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            Just now
          </div>
        </div>
      </div>
      ${actHTML}${progHTML}
      <button class="fg-tcls" aria-label="Close">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`;

    toast.addEventListener('mouseenter', () => toast.classList.add('fg-paused'));
    toast.addEventListener('mouseleave', () => toast.classList.remove('fg-paused'));
    toast.querySelector('.fg-tcls').addEventListener('click', () => dismissToast(toast));
    addSwipe(toast);
    wrap.appendChild(toast);
    activeToasts.push(toast);

    if (duration > 0) toast._timer = setTimeout(() => dismissToast(toast), duration);

    // History
    addToHistory({
      id,
      type,
      category:  opts.category || 'system',
      title:     title   || '',
      message:   message || '',
      timestamp: Date.now(),
      read:      false,
      href:      opts.href || null,
    });

    // Bell ring
    if (!centerOpen) {
      [document.getElementById('fg-notif-bell'), document.getElementById('fg-mobile-bell-btn')]
        .forEach(b => {
          if (!b) return;
          b.classList.remove('ringing');
          void b.offsetWidth; // reflow for re-trigger
          b.classList.add('ringing');
          setTimeout(() => b.classList.remove('ringing'), 700);
        });
    }

    // Sound
    playSound();

    return { id, dismiss: () => dismissToast(toast) };
  };

  // ─── Progress notification ────────────────────────────
  window.notifyProgress = function (title, message) {
    const conf = TYPES.info;
    const wrap = getWrap();
    while (activeToasts.length >= MAX_TOASTS) dismissToast(activeToasts[0]);
    const id    = `fgp-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = 'fg-t';
    toast.id = id;
    toast.style.cssText = `--fgt-c:${conf.color};--fgt-bg:${conf.bg}`;
    toast.innerHTML = `
      <div class="fg-ti">
        <div class="fg-tic" id="${id}-ic" style="animation:fgSpinI 0.9s linear infinite;font-size:20px">↻</div>
        <div class="fg-tb">
          <div class="fg-tbt" id="${id}-title">${title}</div>
          <div class="fg-tbm" id="${id}-msg">${message}</div>
        </div>
      </div>
      <div class="fg-tpbar-wrap"><div class="fg-prog-slide" style="--fgt-c:${conf.color}"></div></div>`;
    wrap.appendChild(toast);
    activeToasts.push(toast);

    return {
      id,
      update(msg) {
        const el = document.getElementById(`${id}-msg`);
        if (el) el.textContent = msg;
      },
      complete(success = true, doneTitle = '', doneMsg = '') {
        const c  = success ? TYPES.success : TYPES.error;
        toast.style.cssText = `--fgt-c:${c.color};--fgt-bg:${c.bg}`;
        const ic  = document.getElementById(`${id}-ic`);
        const ttl = document.getElementById(`${id}-title`);
        const msg = document.getElementById(`${id}-msg`);
        if (ic)  { ic.style.animation = ''; ic.textContent = c.icon; }
        if (ttl) ttl.textContent = doneTitle || (success ? 'Done!' : 'Failed');
        if (msg) msg.textContent = doneMsg || '';
        // Replace indeterminate bar with finishing bar
        const barWrap = toast.querySelector('.fg-tpbar-wrap');
        if (barWrap) barWrap.innerHTML = `<div class="fg-tpbar" style="animation-duration:3000ms;--fgt-c:${c.color}"></div>`;
        // Add close btn
        if (!toast.querySelector('.fg-tcls')) {
          const cls = document.createElement('button');
          cls.className = 'fg-tcls';
          cls.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
          cls.addEventListener('click', () => dismissToast(toast));
          toast.appendChild(cls);
        }
        toast._timer = setTimeout(() => dismissToast(toast), 3000);
      },
      dismiss: () => dismissToast(toast),
    };
  };

  // ─── Convenience shortcuts ────────────────────────────
  window.notifySuccess = (title, msg, dur, opts) => window.notify('success', title, msg, dur,    opts);
  window.notifyError   = (title, msg, dur, opts) => window.notify('error',   title, msg, dur,    opts);
  window.notifyWarn    = (title, msg, dur, opts) => window.notify('warning', title, msg, dur,    opts);
  window.notifyInfo    = (title, msg, dur, opts) => window.notify('info',    title, msg, dur,    opts);
  window.notifyPromo   = (title, msg, dur, opts) => window.notify('promo',   title, msg, dur,    opts);
  window.notifyLoyalty = (title, msg, dur, opts) => window.notify('loyalty', title, msg, dur,    opts);

  // Legacy bridge (auth.js defines its own showToast that calls notify,
  // so we only expose this as a minimal fallback)
  if (!window.showToast) {
    window.showToast = (message, type = 'info', duration = 3500) => {
      const map = { danger: 'error', success: 'success', warning: 'warning', info: 'info' };
      window.notify(map[type] || 'info', '', message, duration);
    };
  }

  // ─── Expose for inline handlers ───────────────────────
  window._fgNC = { open: openCenter, close: closeCenter };

  // ─── Auto-inject bells ───────────────────────────────
  function tryInject() {
    if (document.querySelector('.sidebar-user')) injectBells();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryInject, 80));
  } else {
    setTimeout(tryInject, 80);
  }
  window.addEventListener('load', () => setTimeout(tryInject, 150));

})();
