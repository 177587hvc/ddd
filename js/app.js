/* ═══════════════════════ APP.JS ═══════════════════════
   入口：页面路由 & 全局初始化
═══════════════════════════════════════════════════════ */

const App = (() => {

  let currentPage = null;

  function goto(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(`page-${page}`);
    if (el) { el.classList.add('active'); currentPage = page; }
    if (page === 'dashboard') {
      try { sessionStorage.removeItem('mc_lastClassId'); } catch (e) { }
    }
    document.body.classList.toggle('class-page-active', page === 'class');
    UI.closeModal();
  }

  async function afterLogin(teacher, dataAlreadyRestored = false) {
    const token = Store.getToken();
    
    if (localStorage.getItem('_needReloadAfterDataRestore') === 'true') {
      localStorage.removeItem('_needReloadAfterDataRestore');
      delete window._needReloadAfterRestore;
      location.reload();
      return;
    }
    
    if (token) {
      if (!dataAlreadyRestored) {
        const result = await Store.loadFromServer(token);
        if (result && result.kicked) {
          UI.toast(result.msg || '登录已失效，请重新登录', 'warning');
          goto('auth');
          return;
        }
      }
      Store.startPolling(300);
      setTimeout(() => {
        const health = Store.checkDataHealth();
        if (!health.ok && health.warnings.length > 0) console.warn('数据健康检查发现可疑问题');
      }, 1000);
    }
    Dashboard.init(teacher);
    let lastClassId = '';
    try { lastClassId = sessionStorage.getItem('mc_lastClassId') || ''; } catch (e) { }
    const cls = lastClassId ? Store.classes.find(lastClassId) : null;
    if (cls) { enterClass(lastClassId); } else { goto('dashboard'); }
    if (typeof ScreenLock !== 'undefined') ScreenLock.tryShowIfLocked();
  }

  function enterClass(classId) {
    const cls = Store.classes.find(classId);
    if (!cls) { UI.toast('班级不存在', 'error'); return; }
    try { sessionStorage.setItem('mc_lastClassId', classId); } catch (e) { }
    goto('class');
    setTimeout(() => { ClassView.init(classId); }, 0);
  }

  async function init() {
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) UI.closeModal();
    });
    document.getElementById('modal-close').addEventListener('click', UI.closeModal);
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (typeof ScreenLock !== 'undefined' && ScreenLock.isActive()) return;
      UI.closeModal();
      document.getElementById('big-screen').classList.remove('open');
      document.getElementById('roll-call').classList.remove('open');
      document.getElementById('remote-score').classList.remove('open');
    });
    Auth.init();
    if (typeof HomeworkStats !== 'undefined') HomeworkStats.init();

    const token = Store.getToken();
    const session = Store.session.get();
    const serverAuthed = typeof window.__serverAuthed !== 'undefined' ? window.__serverAuthed : null;

    function hideLoader() {
      const loader = document.getElementById('app-loading-screen');
      if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 300); }
    }

    if (serverAuthed === true && token && session) {
      await afterLogin(session);
      Store.apiVerify(token).then(r => {
        if (r.ok) { Store.teachers.upsert(r.teacher); Store.session.set(r.teacher); }
        else if (r.msg !== 'offline') { Store.clearToken(); Store.session.clear(); }
      });
      hideLoader();
      return;
    }

    if (token) {
      const result = await Store.apiVerify(token);
      if (result.ok) {
        const teacher = result.teacher;
        Store.teachers.upsert(teacher);
        Store.session.set(teacher);
        await afterLogin(teacher);
      } else if (result.msg === 'offline') {
        if (session) { UI.toast('当前处于离线模式，数据暂不同步', 'warning'); await afterLogin(session); }
        else { goto('auth'); }
      } else {
        Store.clearToken();
        Store.session.clear();
        UI.toast(result.msg || '登录已过期，请重新登录', 'warning');
        goto('auth');
      }
      hideLoader();
      return;
    }

    if (session) { await afterLogin(session); hideLoader(); return; }
    goto('auth');
    hideLoader();
  }

  return { goto, afterLogin, enterClass, init, get currentPage() { return currentPage; } };
})();

window.addEventListener('DOMContentLoaded', () => {
  Effects.initTheme();
  Effects.initCardTilt();
  App.init();
});
