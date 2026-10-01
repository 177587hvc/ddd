/* ═══════════════════════ SCREEN-LOCK.JS ═══════════════════════
   班级页「锁屏」：本地密码遮罩，防离开座位时被操作。
   忘记密码：退出登录（清除锁屏数据）后重新登录。
═══════════════════════════════════════════════════════════════ */

const ScreenLock = (() => {
  const CRED_KEY = 'mc_screen_lock_cred_v1';
  const ACTIVE_KEY = 'mc_screen_lock_active_v1';

  function fnv1a(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function hashPw(salt, password) {
    return fnv1a(`${salt}\n${password}`);
  }

  function randomSalt() {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  function savePassword(password) {
    const salt = randomSalt();
    const hash = hashPw(salt, password);
    localStorage.setItem(CRED_KEY, JSON.stringify({ salt, hash }));
  }

  function verifyPassword(password) {
    try {
      const raw = localStorage.getItem(CRED_KEY);
      if (!raw) return false;
      const { salt, hash } = JSON.parse(raw);
      if (!salt || !hash) return false;
      return hashPw(salt, password) === hash;
    } catch(e) {
      return false;
    }
  }

  function hasCredentials() {
    try {
      const raw = localStorage.getItem(CRED_KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      return !!(o && o.salt && o.hash);
    } catch(e) {
      return false;
    }
  }

  function clearCredentials() {
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    hideOverlay();
  }

  function setActive(locked) {
    if (locked) localStorage.setItem(ACTIVE_KEY, '1');
    else localStorage.removeItem(ACTIVE_KEY);
  }

  function isActive() {
    return localStorage.getItem(ACTIVE_KEY) === '1';
  }

  function showUnlockModal() {
    const el = document.getElementById('screen-lock-overlay');
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    const inp = document.getElementById('screen-lock-input');
    if (inp) {
      inp.value = '';
      setTimeout(() => inp.focus(), 120);
    }
  }

  function hideUnlockModal() {
    const el = document.getElementById('screen-lock-overlay');
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
  }

  function enterLockMode() {
    document.body.classList.add('screen-lock-on');
    const bar = document.getElementById('screen-lock-bar');
    const guard = document.getElementById('screen-lock-guard');
    if (bar) bar.setAttribute('aria-hidden', 'false');
    if (guard) guard.setAttribute('aria-hidden', 'false');
  }

  function exitLockMode() {
    document.body.classList.remove('screen-lock-on');
    const bar = document.getElementById('screen-lock-bar');
    const guard = document.getElementById('screen-lock-guard');
    if (bar) bar.setAttribute('aria-hidden', 'true');
    if (guard) guard.setAttribute('aria-hidden', 'true');
    hideUnlockModal();
  }

  function showOverlay() { enterLockMode(); showUnlockModal(); }
  function hideOverlay() { exitLockMode(); }

  function unlockWithPassword(pw) {
    if (!verifyPassword(pw)) {
      if (typeof UI !== 'undefined') UI.toast('密码错误', 'error');
      return false;
    }
    setActive(false);
    exitLockMode();
    if (typeof UI !== 'undefined') UI.toast('已解锁', 'success');
    return true;
  }

  function bindOverlayOnce() {
    if (window._mcScreenLockBound) return;
    window._mcScreenLockBound = true;
    const unlockBtn = document.getElementById('screen-lock-unlock-btn');
    const inp = document.getElementById('screen-lock-input');
    const forgotBtn = document.getElementById('screen-lock-forgot-btn');
    const closeBtn = document.getElementById('screen-lock-close-btn');
    const guard = document.getElementById('screen-lock-guard');
    const overlay = document.getElementById('screen-lock-overlay');
    if (unlockBtn) unlockBtn.onclick = () => unlockWithPassword(inp && inp.value ? inp.value.trim() : '');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') unlockWithPassword(inp.value ? inp.value.trim() : ''); });
    if (forgotBtn) {
      forgotBtn.onclick = async () => {
        const ok = window.confirm('将退出当前账号并清除锁屏，确定吗？退出后请重新登录。');
        if (!ok) return;
        clearCredentials(); exitLockMode();
        if (typeof Auth !== 'undefined' && Auth.logout) await Auth.logout();
      };
    }
    if (closeBtn) closeBtn.onclick = () => hideUnlockModal();
    if (guard) guard.addEventListener('click', () => { if (isActive()) showUnlockModal(); });
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) hideUnlockModal(); });
  }

  function tryShowIfLocked() {
    bindOverlayOnce();
    if (!hasCredentials()) { setActive(false); return; }
    if (isActive()) { enterLockMode(); showUnlockModal(); }
  }

  function openSetupModal() {
    const body = `
      <p style="margin-bottom:1rem;color:var(--text-muted);font-size:.875rem;line-height:1.55">
        锁屏后需输入密码解锁。若<strong>忘记锁屏密码</strong>，请点击班级列表页右上角「退出登录」重新登录即可（锁屏信息会清除）。
      </p>
      <div class="form-field" style="margin-bottom:.75rem">
        <label>锁屏密码</label>
        <input type="password" id="sl-setup-pw1" class="filter-input" style="width:100%" placeholder="至少 4 位" autocomplete="off">
      </div>
      <div class="form-field" style="margin-bottom:1rem">
        <label>确认密码</label>
        <input type="password" id="sl-setup-pw2" class="filter-input" style="width:100%" placeholder="再次输入" autocomplete="off">
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-ghost" onclick="UI.closeModal()">取消</button>
        <button type="button" class="btn-primary" id="sl-setup-confirm">确认锁屏</button>
      </div>`;
    UI.openModal('🔒 设置锁屏密码', body, { narrow: true });
    document.getElementById('sl-setup-confirm').onclick = () => {
      const p1 = document.getElementById('sl-setup-pw1').value.trim();
      const p2 = document.getElementById('sl-setup-pw2').value.trim();
      if (p1.length < 4) { UI.toast('密码至少 4 位', 'warning'); return; }
      if (p1 !== p2) { UI.toast('两次密码不一致', 'warning'); return; }
      savePassword(p1); setActive(true); UI.closeModal(); bindOverlayOnce(); enterLockMode(); showUnlockModal();
    };
  }

  function requestLock() {
    bindOverlayOnce();
    if (!hasCredentials()) { openSetupModal(); return; }
    setActive(true); enterLockMode(); showUnlockModal();
  }

  return { requestLock, tryShowIfLocked, clearCredentials, hasCredentials, isActive, bindOverlayOnce };
})();