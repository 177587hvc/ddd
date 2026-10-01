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
    
    // 检查是否需要刷新页面（登录时拉取了大量服务器数据）
    // 注意：必须在 loadFromServer 之前检查，因为登录时已经拉取过数据了
    if (localStorage.getItem('_needReloadAfterDataRestore') === 'true') {
      localStorage.removeItem('_needReloadAfterDataRestore');
      delete window._needReloadAfterRestore;
      console.log('[数据同步] 检测到数据已更新，立即刷新页面以显示最新数据');
      // 立即刷新，不使用 setTimeout，避免被其他代码中断
      location.reload();
      return; // 不继续执行后续流程，等待页面刷新
    }
    
    if (token) {
      // fresh login 场景（apiLogin 内部已调用过 _restoreData）跳过冗余 loadFromServer
      // 但页面刷新/init 路径仍需要 loadFromServer 从服务器拉最新数据
      if (!dataAlreadyRestored) {
        const result = await Store.loadFromServer(token);
        if (result && result.kicked) {
          UI.toast(result.msg || '登录已失效，请重新登录', 'warning');
          goto('auth');
          return;
        }
      }
      Store.startPolling(300); // 开启实时同步 (300ms 极速轮询)
      
      // 数据健康检查：登录后自动检测数据完整性
      setTimeout(() => {
        const health = Store.checkDataHealth();
        console.log('数据健康检查:', health);
        
        if (!health.ok && health.warnings.length > 0) {
          console.error('检测到数据异常:', health.warnings);
          console.warn('数据健康检查发现可疑问题，但不影响使用。详情请查看控制台。');
        }
      }, 1000);
    }
    Dashboard.init(teacher);
    // 刷新时恢复上次所在的班级
    let lastClassId = '';
    try { lastClassId = sessionStorage.getItem('mc_lastClassId') || ''; } catch (e) { }
    const cls = lastClassId ? Store.classes.find(lastClassId) : null;
    if (cls) {
      enterClass(lastClassId);
    } else {
      goto('dashboard');
    }
    if (typeof ScreenLock !== 'undefined') ScreenLock.tryShowIfLocked();
  }

  function enterClass(classId) {
    const cls = Store.classes.find(classId);
    if (!cls) { UI.toast('班级不存在', 'error'); return; }
    try { sessionStorage.setItem('mc_lastClassId', classId); } catch (e) { }
    
    // Switch page immediately
    goto('class');
    
    // Defer heavy rendering to next tick
    setTimeout(() => {
      ClassView.init(classId);
    }, 0);
  }

  async function init() {
    // 关闭 Modal
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) UI.closeModal();
    });
    document.getElementById('modal-close').addEventListener('click', UI.closeModal);

    // ESC 关闭所有全屏覆盖层
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (typeof ScreenLock !== 'undefined' && ScreenLock.isActive()) return;
      UI.closeModal();
      document.getElementById('big-screen').classList.remove('open');
      document.getElementById('roll-call').classList.remove('open');
      document.getElementById('remote-score').classList.remove('open');
    });

    // 齿轮菜单已改为居中弹框，无需额外关闭逻辑

    // 始终绑定登录/注册监听
    Auth.init();

    // 初始化作业统计模块（绑定按钮事件）
    if (typeof HomeworkStats !== 'undefined') HomeworkStats.init();

    /* ── 会话恢复 ─────────────────────────────────────
       优先级：
       1. PHP Session 有效（window.__serverAuthed = true）
          + localStorage 有 token
          → 快速路径：直接进入 dashboard，异步刷新 PHP Session
       2. PHP Session 无效（__serverAuthed = false）
          + 有 token → 可能是 PHP session 过期，异步验证 token
            a. token 仍有效 → 进入 dashboard（同时刷新 PHP Session）
            b. token 无效   → 清除数据 → 去登录页
          + 无 token → 去登录页
       3. 无 PHP 环境（__serverAuthed 未定义，纯本地调试模式）
          → 向后兼容，按 token / localStorage session 判断
    ─────────────────────────────────────────────────── */
    const token = Store.getToken();
    const session = Store.session.get();
    const serverAuthed = typeof window.__serverAuthed !== 'undefined'
      ? window.__serverAuthed : null;

    function hideLoader() {
      const loader = document.getElementById('app-loading-screen');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 300);
      }
    }

    // ① PHP Session 已认证 + 有 token → 快速进入（最常见情况）
    if (serverAuthed === true && token && session) {
      await afterLogin(session);
      // 后台异步刷新 PHP Session（保持 Session 活跃）
      Store.apiVerify(token).then(r => {
        if (r.ok) {
          Store.teachers.upsert(r.teacher);
          Store.session.set(r.teacher);
        } else if (r.msg !== 'offline') {
          // token 实际已失效（罕见），下次刷新时会进入 ② 流程
          Store.clearToken();
          Store.session.clear();
        }
      });
      hideLoader();
      return;
    }

    // ② PHP Session 无效 / 无 PHP 环境，有 token → 向服务端验证
    if (token) {
      const result = await Store.apiVerify(token);
      if (result.ok) {
        const teacher = result.teacher;
        Store.teachers.upsert(teacher);
        Store.session.set(teacher);
        await afterLogin(teacher);
      } else if (result.msg === 'offline') {
        // 离线降级：信任本地 session
        if (session) {
          UI.toast('当前处于离线模式，数据暂不同步', 'warning');
          await afterLogin(session);
        } else {
          goto('auth');
        }
      } else {
        Store.clearToken();
        Store.session.clear();
        UI.toast(result.msg || '登录已过期，请重新登录', 'warning');
        goto('auth');
      }
      hideLoader();
      return;
    }

    // ③ 旧版本数据（无 token 但有 localStorage session）→ 向后兼容
    if (session) {
      await afterLogin(session);
      hideLoader();
      return;
    }

    // ④ 完全未登录
    goto('auth');
    hideLoader();
  }

  return { goto, afterLogin, enterClass, init, get currentPage() { return currentPage; } };
})();

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  Effects.initTheme();
  Effects.initCardTilt();
  App.init();
});
