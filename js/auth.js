/* ═══════════════════════ AUTH.JS ═══════════════════════
   登录 / 注册 —— 通过 PHP 后端 API 完成
═══════════════════════════════════════════════════════ */

const Auth = (() => {

  const REG_USERNAME_ALLOWED = /[^a-zA-Z0-9]/g;

  function _sanitizeRegUsernameInput(el) {
    if (!el) return;
    let v = el.value.replace(REG_USERNAME_ALLOWED, '');
    if (v.length > 50) v = v.slice(0, 50);
    if (v !== el.value) {
      el.value = v;
      if (typeof UI !== 'undefined') {
        UI.toast('账号仅能使用英文字母与数字，请正确输入', 'error', 2800);
      }
    }
  }

  function init() {
    try { localStorage.removeItem('pets_auth_remember'); } catch (e) {}

    document.querySelectorAll('.auth-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.auth;
        document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('form-login').classList.toggle('hidden', mode !== 'login');
        document.getElementById('form-register').classList.toggle('hidden', mode !== 'register');
        requestAnimationFrame(() => {
          const targetForm = mode === 'login'
            ? document.getElementById('form-login')
            : document.getElementById('form-register');
          if (targetForm) {
            const firstInput = targetForm.querySelector('input');
            if (firstInput) firstInput.focus({ preventScroll: true });
          }
        });
      });
    });

    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-register').addEventListener('click', register);

    const regUserEl = document.getElementById('reg-username');
    if (regUserEl) {
      let ime = false;
      regUserEl.addEventListener('compositionstart', () => { ime = true; });
      regUserEl.addEventListener('compositionend', () => {
        ime = false;
        _sanitizeRegUsernameInput(regUserEl);
      });
      regUserEl.addEventListener('input', () => {
        if (ime) return;
        _sanitizeRegUsernameInput(regUserEl);
      });
    }

    fetchActivationCodeUrl();

    document.getElementById('page-auth').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const loginVisible = !document.getElementById('form-login').classList.contains('hidden');
      if (loginVisible) login(); else register();
    });
  }

  async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { UI.toast('请填写账号和密码', 'warning'); return; }

    _setLoading('btn-login', true, '登录中...');
    const result = await Store.apiLogin(username, password);
    _setLoading('btn-login', false, '登 录');

    if (!result.ok) { UI.toast(result.msg || '登录失败', 'error'); return; }

    Store.setToken(result.token);
    Store.teachers.upsert(result.teacher);
    Store.session.set(result.teacher);

    if (!result.data) {
      const localRecords = Store.records.all() || [];
      const localStudents = Store.students.all() || [];
      if (localRecords.length >= 3 || localStudents.length >= 1) {
        console.log('[登录] 检测到本地有数据但服务器为空，准备上传本地数据');
        setTimeout(() => Store.forceSync(), 300);
      }
    }

    UI.toast(`欢迎回来，${result.teacher.name}！`, 'success');
    App.afterLogin(result.teacher, true);
  }

  async function register() {
    const username       = document.getElementById('reg-username').value.trim();
    const name           = document.getElementById('reg-name').value.trim();
    const password       = document.getElementById('reg-password').value;
    const confirm        = document.getElementById('reg-confirm').value;
    const activationCode = document.getElementById('reg-activation-code').value.trim().toUpperCase();

    if (!username || !name || !password || !confirm) {
      UI.toast('请填写所有字段', 'warning'); return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      UI.toast('账号仅能使用英文字母与数字，请正确输入', 'error'); return;
    }
    if (username.length > 50) {
      UI.toast('账号长度不能超过50个字符', 'warning'); return;
    }
    if (password.length < 6) {
      UI.toast('密码至少6位', 'warning'); return;
    }
    if (password !== confirm) {
      UI.toast('两次密码不一致', 'warning'); return;
    }
    if (!activationCode) {
      UI.toast('请填写激活码', 'warning'); return;
    }

    _setLoading('btn-register', true, '注册中...');
    const result = await Store.apiRegister(username, name, password, activationCode);
    _setLoading('btn-register', false, '注 册');

    if (!result.ok) {
      UI.toast(result.msg || '注册失败', 'error');
      return;
    }

    Store.setToken(result.token);
    Store.teachers.upsert(result.teacher);
    Store.session.set(result.teacher);

    UI.toast(`注册成功，欢迎 ${name}！`, 'success');
    App.afterLogin(result.teacher, true);
  }

  async function fetchActivationCodeUrl() {
    const codeLink = document.getElementById('link-get-activation-code');
    if (!codeLink) return;
    try {
      const res = await fetch(Store.API + '?action=getPublicConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (json.ok && json.activationCodeShopUrl) {
        codeLink.href = json.activationCodeShopUrl;
        codeLink.style.display = '';
      } else {
        codeLink.style.display = 'none';
      }
    } catch(e) {
      codeLink.style.display = 'none';
    }
  }

  async function logout() {
    if (typeof ScreenLock !== 'undefined') ScreenLock.clearCredentials();
    UI.toast('退出中，正在同步数据...', 'info');
    await Store.apiLogout();
    Store.session.clear();
    App.goto('auth');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  }

  function _setLoading(btnId, loading, text) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = text;
  }

  return { init, logout };
})();