// ================================================
// FuelGO — loader.js
// Description: Page loader and slim top progress bar
// Author: FuelGO Dev
// ================================================
(function () {
  // ── Top progress bar ──────────────────────────
  const bar = document.createElement('div');
  bar.id = 'fg-progress-bar';
  Object.assign(bar.style, {
    position: 'fixed', top: '0', left: '0', height: '3px',
    width: '0%', background: '#F97316', zIndex: '99998',
    transition: 'width 0.3s ease, opacity 0.4s ease',
    borderRadius: '0 2px 2px 0', opacity: '0',
  });
  document.body.appendChild(bar);

  let timer = null;
  function startBar() {
    clearTimeout(timer);
    bar.style.opacity = '1';
    bar.style.width = '0%';
    requestAnimationFrame(() => { bar.style.width = '80%'; });
  }
  function finishBar() {
    bar.style.width = '100%';
    timer = setTimeout(() => { bar.style.opacity = '0'; bar.style.width = '0%'; }, 350);
  }

  // ── Page loader overlay ───────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'fg-page-loader';
  overlay.innerHTML = `
    <div style="text-align:center">
      <div style="
        width:56px;height:56px;border-radius:50%;
        border:4px solid #F3F4F6;border-top-color:#F97316;
        animation:fgSpin 0.8s linear infinite;margin:0 auto 16px;
      "></div>
      <div style="font-family:'Syne',sans-serif;font-size:1.3rem;font-weight:800;color:#0F2548">Fuel<span style="color:#F97316">GO</span></div>
    </div>
  `;
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: '999999', transition: 'opacity 0.4s ease',
  });

  if (!document.getElementById('fg-loader-css')) {
    const s = document.createElement('style');
    s.id = 'fg-loader-css';
    s.textContent = '@keyframes fgSpin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(overlay);
  });

  window.showPageLoader  = () => { if (overlay.parentNode) overlay.style.opacity = '1'; };
  window.hidePageLoader  = () => {
    overlay.style.opacity = '0';
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 450);
  };
  window.startProgress  = startBar;
  window.finishProgress = finishBar;

  // Auto-hide after 8s as a safety net
  window.addEventListener('load', () => setTimeout(window.hidePageLoader, 500));
})();
