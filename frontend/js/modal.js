// ================================================
// FuelGO — modal.js
// Description: Reusable confirmation modal (returns Promise)
// Author: FuelGO Dev
// ================================================
(function () {
  if (!document.getElementById('fg-modal-css')) {
    const s = document.createElement('style');
    s.id = 'fg-modal-css';
    s.textContent = `
      #fg-confirm-overlay {
        position: fixed; inset: 0; z-index: 99997;
        background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        animation: fgFadeIn 0.2s ease both;
      }
      @keyframes fgFadeIn { from { opacity:0 } to { opacity:1 } }
      #fg-confirm-box {
        background: #fff; border-radius: 16px;
        padding: 32px; max-width: 420px; width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        animation: fgSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      @keyframes fgSlideUp { from { transform:translateY(30px);opacity:0 } to { transform:translateY(0);opacity:1 } }
      #fg-confirm-box h3 { margin:0 0 10px; font-size:1.15rem; color:#0F2548; }
      #fg-confirm-box p  { margin:0 0 24px; color:#6B7280; font-size:0.92rem; line-height:1.5; }
      .fg-confirm-btns { display:flex; gap:10px; justify-content:flex-end; }
      .fg-confirm-btns button { padding:9px 20px; border-radius:8px; border:none; cursor:pointer; font-size:0.9rem; font-weight:600; }
      .fg-btn-cancel  { background:#F3F4F6; color:#374151; }
      .fg-btn-cancel:hover { background:#E5E7EB; }
      .fg-btn-confirm { background:#EF4444; color:#fff; }
      .fg-btn-confirm:hover { background:#DC2626; }
      .fg-btn-confirm.green  { background:#22C55E; }
      .fg-btn-confirm.green:hover { background:#16A34A; }
      .fg-btn-confirm.orange { background:#F97316; }
      .fg-btn-confirm.orange:hover { background:#EA6D0D; }
    `;
    document.head.appendChild(s);
  }

  /**
   * Show a confirmation modal.
   * @param {string} title
   * @param {string} body
   * @param {string} confirmText - Button label
   * @param {string} confirmClass - 'red'|'green'|'orange'
   * @returns {Promise<boolean>}
   */
  window.confirmModal = function (title, body, confirmText = 'Confirm', confirmClass = 'red') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = 'fg-confirm-overlay';
      overlay.innerHTML = `
        <div id="fg-confirm-box">
          <h3>${title}</h3>
          <p>${body}</p>
          <div class="fg-confirm-btns">
            <button class="fg-btn-cancel" id="fg-cancel-btn">Cancel</button>
            <button class="fg-btn-confirm ${confirmClass === 'green' ? 'green' : confirmClass === 'orange' ? 'orange' : ''}" id="fg-ok-btn">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const okBtn = overlay.querySelector('#fg-ok-btn');
      okBtn.focus();

      const ac = new AbortController();
      const close = (val) => { ac.abort(); overlay.remove(); resolve(val); };

      overlay.querySelector('#fg-cancel-btn').addEventListener('click', () => close(false), { signal: ac.signal });
      okBtn.addEventListener('click', () => close(true), { signal: ac.signal });
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); }, { signal: ac.signal });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        else if (e.key === 'Enter' && !okBtn.disabled) { e.preventDefault(); close(true); }
      }, { signal: ac.signal });
    });
  };
})();
