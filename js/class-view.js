/* ═══════════════════════ CLASS-VIEW.JS ═══════════════════════
   Class interior: nav buttons, tabs, big screen, roll call,
   remote score, level settings, data center
═══════════════════════════════════════════════════════════════ */

const ClassView = (() => {

  let currentClassId = null;
  let currentTab = 'students';

  function init(classId) {
    currentClassId = classId;
    const cls = Store.classes.find(classId);
    if (!cls) return;

    document.querySelector('.class-page-name').textContent = cls.name;
    document.querySelector('.class-page-grade').textContent = cls.grade || '';

    // Tab switching (still works even though tabs are hidden)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => switchTab(btn.dataset.tab);
    });

    // 返回：在子标签页时退回卡片列表，在卡片列表时退回班级选择
    document.getElementById('btn-back-dashboard').onclick = () => {
      if (currentTab !== 'students') {
        switchTab('students');
      } else {
        App.goto('dashboard');
      }
    };
    document.getElementById('nav-tug-of-war-btn').onclick = () => window.open('拔河游戏全科版/科目拔河.html', '_blank');
    document.getElementById('nav-shout-btn').onclick = () => Announcements.openShoutModal();
    document.getElementById('nav-honor-btn').onclick = showHonorRoll;
    document.getElementById('nav-group-rank-btn').onclick = showGroupRank;
    document.getElementById('nav-shop-btn').onclick = () => Shop.openAsModal();
    document.getElementById('nav-undo-btn').onclick = undoLastAction;
    document.getElementById('nav-settings-btn').onclick = e => {
      e.stopPropagation(); showSettingsDropdown(document.getElementById('nav-settings-btn'));
    };

    // Mobile bottom bar (same actions, for small screens)
    const mobBar = document.getElementById('mob-bottom-bar');
    if (mobBar) {
      mobBar.querySelectorAll('[data-mob-action]').forEach(btn => {
        btn.onclick = () => {
          const act = btn.dataset.mobAction;
          if (act === 'batch') {
            if (currentTab !== 'students') switchTab('students');
            Students.toggleEditMode();
          } else if (act === 'honor') showHonorRoll();
          else if (act === 'shop') Shop.openAsModal();
          else if (act === 'undo') undoLastAction();
          else if (act === 'settings') showSettingsDropdown(btn);
        };
      });
    }
    
    // 手机端专用显眼按钮：隔空喊话 & 批量操作
    const mobShoutBtn = document.getElementById('mob-shout-btn');
    if (mobShoutBtn) mobShoutBtn.onclick = () => Announcements.openShoutModal();
    const mobBatchBtn = document.getElementById('mob-batch-btn');
    if (mobBatchBtn) {
      mobBatchBtn.onclick = () => {
        if (currentTab !== 'students') switchTab('students');
        Students.toggleEditMode();
      };
    }

    // Header search
    document.getElementById('ch-search').oninput = function () {
      Students.setSearchFilter(this.value);
    };

    // 视图密度切换：三列/四列模式
    const densityBtn = document.getElementById('btn-toggle-density');
    const grid = document.getElementById('students-grid');
    if (densityBtn && grid) {
      // 还原上次的选择
      const isCompact = localStorage.getItem('pets_grid_compact') === '1';
      if (isCompact) {
        grid.classList.add('grid-compact');
        densityBtn.classList.add('active');
      }
      densityBtn.onclick = () => {
        const active = grid.classList.toggle('grid-compact');
        densityBtn.classList.toggle('active', active);
        localStorage.setItem('pets_grid_compact', active ? '1' : '0');
        UI.toast(active ? '已开启紧凑模式 (3-4列)' : '已恢复标准模式', 'info', 1500);
      };
    }

    // Honor roll close
    document.getElementById('hr-close').onclick = () => {
      document.getElementById('honor-roll').classList.remove('open');
    };

    const hrTabsEl = document.getElementById('hr-period-tabs');
    if (hrTabsEl && !hrTabsEl.dataset.bound) {
      hrTabsEl.dataset.bound = '1';
      hrTabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-hr-period]');
        if (!btn) return;
        const period = btn.dataset.hrPeriod;
        if (!period || !currentClassId) return;
        renderHonorRollList(period);
      });
    }

    // Sub-modules
    Students.init(classId);
    Groups.init(classId);
    Records.init(classId);
    Shop.init(classId);
    LuckyWheel.init(classId);

    const shareFab = document.getElementById('class-share-fab');
    if (shareFab) shareFab.onclick = () => openClassShareModal();

    // Multi-device sync refresh
    if (!window._classViewSyncBound) {
      window._classViewSyncBound = true;
      window.addEventListener('pets-data-sync', () => {
        if (currentClassId && App.currentPage === 'class') {
          // 核心修复：彻底解决“升级跳转顶部”
          // 如果正在显示升级动画、弹窗已打开，或者处于加分后的冷却锁定状态，则不执行后台刷新
          if (document.getElementById('levelup-overlay')) return;
          if (document.getElementById('modal-overlay').classList.contains('open')) return;
          if (window._mc_sync_lock) return;

          // 1. 重新渲染页面上的核心模块
          Students.render();
          Groups.render();
          Records.render(currentClassId);
          Shop.render();
          renderGroupFilter();

          // 2. 实时刷新光荣榜（如果正在打开状态）
          const honorRollEl = document.getElementById('honor-roll');
          if (honorRollEl && honorRollEl.classList.contains('open')) {
            const activePeriodBtn = document.querySelector('.hr-tab.active');
            const currentPeriod = activePeriodBtn ? activePeriodBtn.dataset.hrPeriod : 'total';
            renderHonorRollList(currentPeriod);
          }

          // 3. 实时刷新正在打开的设置弹窗（防止配置不同步）
          // 优化：只有当弹窗确实处于打开状态（含有 .open 类）时才尝试刷新内容
          const overlayEl = document.getElementById('modal-overlay');
          if (overlayEl && overlayEl.classList.contains('open') && !window._isSavingConfig) {
            const modalTitle = (document.getElementById('modal-title')==null?void 0:document.getElementById('modal-title')).textContent;
            if (modalTitle) {
              if (modalTitle.includes('加分减分配置')) showScoreItemsSettings();
              else if (modalTitle.includes('升级设置')) showLevelSettings();
              else if (modalTitle.includes('饥饿设置')) showHungerSettings();
            }
          }
        }
      });
    }

    renderGroupFilter();
    bindGroupFilterBar();
    switchTab('students');
  }

  /** 构建发给服务端快照：当前班级学生宠物进度与已养成列表（家长可见） */
  function buildClassShareSnapshot(classId) {
    const cls = Store.classes.find(classId);
    const levelCfg = Store.levels.get(classId);
    const groups = Store.groups.byClass(classId);
    const byGid = gid => groups.find(g => g.id === gid);
    const list = Store.students.byClass(classId).slice();
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'));

    const maxSt = getMaxLevel(levelCfg).stage || 10;
    const students = list.map(s => {
      const gid = s.groupId || (s.groupIds && s.groupIds[0]);
      const g = gid ? byGid(gid) : null;
      const isNeg = (s.totalScore || 0) < 0 || getLeaderboardWelfareScore(s) < 0;
      const petType = s.petType || null;
      let li = petType
        ? calcLevelInfo(s.fedLegs || 0, levelCfg)
        : { level: 0, title: '待领养', stage: 1, progress: 0, remaining: 0, nextFeeds: null };
      const petName = petType ? ((getPet(petType) || {}).name || petType) : '尚未领养';

      let currentPetImg = '';
      if (petType) {
        currentPetImg = isNeg && typeof PO_IMG !== 'undefined'
          ? PO_IMG
          : getPetImg(petType, li.stage);
      } else if (typeof ADOPT_EGG_IMG !== 'undefined') {
        // 与教师端一致：无当前宠物时（含批量导入待领养、召唤神兽后）均展示待领养蛋图
        currentPetImg = ADOPT_EGG_IMG;
      }

      const fullLevelPets = (s.fullLevelPets || []).map(e => ({
        petType: e.petType,
        petName: e.petName || ((getPet(e.petType) || {}).name || e.petType),
        imgPath: e.imgPath || getPetImg(e.petType, maxSt),
        date: e.date || '',
      }));

      // ── 新增：包含详细加减分记录 ──
      const sid = s.id;
      const rawRecords = Store.records.byStudent(sid)
        .filter(r => ['add', 'deduct', 'redeem'].includes(r.type))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50); // 仅保留最近 50 条

      const records = rawRecords.map(r => ({
        type: r.type,
        amount: r.amount,
        reason: r.reason,
        createdAt: r.createdAt
      }));

      let progressNote = '';
      if (petType) {
        if (li.nextFeeds != null) {
          progressNote = `距离下一级还差 ${li.remaining} 次投喂`;
        } else {
          progressNote = '已达当前体系最高等级';
        }
      } else if (fullLevelPets.length) {
        progressNote = '可领养新宠物';
      } else {
        progressNote = '待领养萌宠';
      }

      return {
        name: s.name,
        groupName: g ? g.name : '',
        badgeScore: s.totalScore || 0,
        petType,
        petName,
        level: li.level,
        title: li.title,
        stage: li.stage,
        progress: li.progress,
        fedLegs: getStudentDisplayFedTotal(s),
        currentPetImg,
        fullLevelPets,
        records, // 注入详细记录
        progressNote,
      };
    });

    return {
      v: 1,
      createdAt: new Date().toISOString(),
      class: { id: cls.id, name: cls.name, grade: cls.grade || '' },
      students,
    };
  }

  function openClassShareModal() {
    if (!currentClassId) return;
    const html = `
      <p class="share-modal-hint">生成只读链接，家长打开即可查看本班每位同学的宠物等级与已养成宠物，无需登录。请勿公开传播。</p>
      <div class="share-modal-row">
        <span class="share-modal-label">有效期</span>
        <select id="share-days-select" class="filter-select share-days-select">
          <option value="3">3 天</option>
          <option value="7" selected>7 天</option>
          <option value="14">14 天</option>
          <option value="30">30 天</option>
          <option value="60">60 天</option>
          <option value="90">90 天</option>
        </select>
      </div>
      <div class="share-modal-row">
        <span class="share-modal-label">搜索模式</span>
        <label class="share-switch-wrapper">
          <input type="checkbox" id="share-search-mode" checked>
          <span class="share-switch-slider"></span>
          <span class="share-switch-text">需输入学生名字查看</span>
        </label>
      </div>
      <div class="modal-footer share-modal-actions">
        <button type="button" class="btn-ghost" id="share-modal-cancel">取消</button>
        <button type="button" class="btn-primary" id="share-modal-create">创建分享</button>
      </div>
      <div id="share-modal-result" class="share-modal-result" hidden>
        <span class="share-url-label">分享链接（发给家长）</span>
        <!-- 新增：复制成功的即时小提示 -->
        <div id="share-copy-tip" style="color:#16a34a; font-size:0.85rem; font-weight:600; margin-bottom:5px; display:none; animation:fadeIn 0.3s;">
          ✨ 已复制！请告知家长复制链接到浏览器打开查看呦！
        </div>
        <div class="share-url-row">
          <input type="text" readonly class="filter-input share-url-input" id="share-url-input">
          <button type="button" class="btn-primary btn-sm" id="share-copy-btn">复制</button>
        </div>
        <p class="share-expires-text" id="share-expires-text"></p>
      </div>`;

    UI.openModal('分享全班概览', html, { wide: true });

    document.getElementById('share-modal-cancel').onclick = () => UI.closeModal();

    document.getElementById('share-modal-create').onclick = async () => {
      const token = Store.getToken();
      if (!token) {
        UI.toast('请先登录账号并确保能同步服务器后再创建分享', 'warning');
        return;
      }
      const days = parseInt(document.getElementById('share-days-select').value, 10);
      const searchMode = document.getElementById('share-search-mode').checked;
      const snap = buildClassShareSnapshot(currentClassId);
      snap.searchMode = searchMode; // 添加搜索模式标志
      const btn = document.getElementById('share-modal-create');
      btn.disabled = true;
      const json = await Store.apiCreateClassShare(days, snap);
      btn.disabled = false;
      if (!json.ok) {
        UI.toast(json.msg || '创建失败', 'error');
        return;
      }
      const url = new URL('share.php', window.location.href);
      url.searchParams.set('id', json.shareId);
      document.getElementById('share-url-input').value = url.toString();
      const exp = json.expiresAt || '';
      document.getElementById('share-expires-text').textContent = exp
        ? '链接有效期至：' + exp.replace(' ', ' ')
        : '';
      document.getElementById('share-modal-result').hidden = false;
      document.getElementById('share-days-select').disabled = true;
      document.getElementById('share-search-mode').disabled = true;
      btn.textContent = '已创建';
      btn.disabled = true;
      UI.toast('已生成分享链接，可复制发给家长', 'success');
    };

    document.getElementById('share-copy-btn').onclick = async () => {
      const inp = document.getElementById('share-url-input');
      const text = inp.value.trim();
      if (!text) {
        UI.toast('请先创建分享', 'info');
        return;
      }
      const doCopy = async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
          throw new Error('Clipboard API unavailable');
        } catch (e) {
          inp.focus();
          inp.select();
          try {
            return document.execCommand('copy');
          } catch (e2) {
            return false;
          }
        }
      };

      const success = await doCopy();
      if (success) {
        const tip = document.getElementById('share-copy-tip');
        if (tip) {
          tip.style.display = 'block';
          setTimeout(() => {
            if (tip) tip.style.display = 'none';
          }, 10000);
        }
        UI.toast('已复制到剪贴板！', 'success');
      } else {
        UI.toast('请长按或 Ctrl+C 手动复制', 'info');
      }
    };
  }

  /* ── 分组筛选条：document 级委托，确保捕获 ── */
  function bindGroupFilterBar() {
    if (window._gfBarDelegateBound) return;
    window._gfBarDelegateBound = true;
    document.addEventListener('click', function _onGfBarClick(e) {
      const bar = document.getElementById('group-filter-bar');
      if (!bar || !bar.contains(e.target)) return;
      const groupsBtn = e.target.closest('.gf-groups-btn');
      if (groupsBtn) {
        switchTab('groups');
        return;
      }
      const pill = e.target.closest('.gfpill');
      if (!pill) return;
      const gf = pill.getAttribute('data-gf');
      const val = gf === '' || gf === null || gf === undefined ? null : gf;
      Students.setGroupFilter(val);
      renderGroupFilter();
      switchTab('students');
    });
  }

  /* ── Render group filter pills ── */
  function renderGroupFilter() {
    const bar = document.getElementById('group-filter-bar');
    if (!bar) return;
    const groups = Store.groups.byClass(currentClassId);
    const allStudents = Store.students.byClass(currentClassId);
    const activeGroup = Students.getGroupFilter ? Students.getGroupFilter() : null;

    const allCount = allStudents.length;
    const ungroupedCount = allStudents.filter(s => !s.groupIds || s.groupIds.length === 0).length;

    let pillsHtml = `
      <button type="button" class="gfpill ${!activeGroup ? 'active' : ''}" data-gf="">
        全部 <span class="gfpill-count">${allCount}</span>
      </button>`;

    if (ungroupedCount > 0) {
      pillsHtml += `
      <button type="button" class="gfpill ${activeGroup === '__none__' ? 'active' : ''}" data-gf="__none__">
        未分组 <span class="gfpill-count">${ungroupedCount}</span>
      </button>`;
    }

    pillsHtml += `
      <button type="button" class="gfpill gf-groups-btn ${currentTab === 'groups' ? 'active' : ''}" title="小组管理">
        👥 小组管理
      </button>`;

    groups.forEach(g => {
      const count = allStudents.filter(s => s.groupIds && s.groupIds.includes(g.id)).length;
      pillsHtml += `
      <button type="button" class="gfpill ${activeGroup === g.id ? 'active' : ''}" data-gf="${g.id}"
        style="${activeGroup === g.id ? '' : `--gc:${g.color}`}">
        <span class="gfpill-dot" style="background:${g.color}"></span>
        ${g.name} <span class="gfpill-count">${count}</span>
      </button>`;
    });

    const html = `
      <div class="gfbar-pills-row">${pillsHtml}</div>
      <div class="gfbar-actions-row">
        <div class="gfbar-sort-wrap" id="gfbar-sort-wrap">
          <button type="button" class="gfbar-btn gfbar-density" id="btn-grid-density" title="调整每行卡片数量">
            <i class="ri ri-layout-grid-line"></i> 调整行数
          </button>
          <button type="button" class="gfbar-btn gfbar-seat" id="btn-seat-edit" title="调整座位：拖动学生卡片交换位置">
            <i class="ri ri-drag-move-2-line"></i> 调整座位
            <span class="seat-switch" aria-hidden="true"><span class="seat-switch-knob"></span></span>
          </button>
          <button type="button" class="gfbar-btn gfbar-reading" id="btn-reading-challenge" title="朗读挑战树">
            <i class="ri ri-leaf-line"></i> 朗读树
          </button>
          <button type="button" class="gfbar-btn gfbar-scratch" id="btn-scratch-card" title="晨读刮刮乐">
            <i class="ri ri-gift-line"></i> 晨读刮刮乐
          </button>
          <button type="button" class="gfbar-btn gfbar-silence" id="btn-silence-challenge" title="静音挑战树">
            <i class="ri ri-moon-clear-line"></i> 静音树
          </button>
          <button type="button" class="gfbar-btn gfbar-sort" id="gfbar-sort-btn" title="学生排序方式">
            <i class="ri ri-sort-desc"></i> 排序
          </button>
          <button type="button" class="gfbar-btn gfbar-screen-lock" id="gfbar-screen-lock-btn" title="离开教室时锁定屏幕">
            <i class="ri ri-lock-line"></i> 锁屏
          </button>
        </div>
        <button type="button" class="gfbar-btn gfbar-export" id="gfbar-export-btn" title="导出班级数据为 Excel">
          <i class="ri ri-file-excel-2-line"></i> 导出数据
        </button>
        <button type="button" class="gfbar-btn gfbar-import" id="gfbar-import-btn" title="从 Excel 批量导入学生">
          <i class="ri ri-upload-2-line"></i> 批量导入
        </button>
        <button type="button" class="gfbar-btn gfbar-batch" id="nav-batch-btn" title="批量加减分">
          批量加减分
        </button>
      </div>`;

    bar.innerHTML = html;
    document.getElementById('gfbar-export-btn').onclick = () => exportClassDataToExcel();
    document.getElementById('gfbar-import-btn').onclick = () => Students.showBatchAdd();
    document.getElementById('nav-batch-btn').onclick = () => {
      if (currentTab !== 'students') switchTab('students');
      Students.toggleEditMode();
    };
    document.getElementById('btn-reading-challenge').onclick = () => AudioChallenge.openModal('reading');
    const densityBtn = document.getElementById('btn-grid-density');
    if (densityBtn) {
      densityBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof Students !== 'undefined' && Students.openDensityAdjuster) {
          Students.openDensityAdjuster(densityBtn);
        }
      };
    }
    const seatBtn = document.getElementById('btn-seat-edit');
    if (seatBtn) {
      const active = typeof Students !== 'undefined' && Students.isSeatEditMode && Students.isSeatEditMode();
      seatBtn.classList.toggle('active', !!active);
      seatBtn.onclick = () => {
        if (typeof Students === 'undefined' || !Students.toggleSeatEditMode) return;
        const on = Students.toggleSeatEditMode();
        seatBtn.classList.toggle('active', !!on);
      };
    }
    document.getElementById('btn-scratch-card').onclick = () => window.open('晨读刮刮乐.html', '_blank');
    document.getElementById('btn-silence-challenge').onclick = () => AudioChallenge.openModal('silence');
    bindSortDropdown();
    const lockBtn = document.getElementById('gfbar-screen-lock-btn');
    if (lockBtn) {
      lockBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof ScreenLock !== 'undefined') ScreenLock.requestLock();
      };
    }
  }

  function bindSortDropdown() {
    const btn = document.getElementById('gfbar-sort-btn');
    if (!btn) return;
    btn.onclick = (e) => {
      e.stopPropagation();
      const existing = document.getElementById('sort-dropdown');
      if (existing) { existing.remove(); return; }
      const current = Students.getSortMode ? Students.getSortMode() : 'default';
      const opts = [
        { id: 'default', label: '默认排序' },
        { id: 'joinOrder', label: '加入顺序' },
        { id: 'nameInitial', label: '名称首字母' },
        { id: 'leaderboard', label: '排行榜' },
        { id: 'progress', label: '进度' },
        { id: 'hungerDeadFirst', label: '饿死优先' },
        { id: 'hungerCriticalFirst', label: '濒临饿死优先' },
      ];
      const dd = document.createElement('div');
      dd.id = 'sort-dropdown';
      dd.className = 'sort-dropdown sort-dropdown-fixed';
      dd.innerHTML = `
        <div class="sort-dropdown-title">学生排序方式</div>
        ${opts.map(o => `
          <button type="button" class="sort-dropdown-item ${o.id === current ? 'active' : ''}" data-sort="${o.id}">
            ${o.label}
            ${o.id === current ? '<span class="sort-item-current">当前</span>' : ''}
          </button>
        `).join('')}
      `;
      document.body.appendChild(dd);
      const rect = btn.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // 手机端：fixed 居中显示，避免被卡片/顶栏遮挡且防止超出视口
        dd.style.position = 'fixed';
        dd.style.left = '50%';
        dd.style.top = '50%';
        dd.style.right = 'auto';
        dd.style.bottom = 'auto';
        dd.style.transform = 'translate(-50%, -50%)';
        dd.style.width = 'min(300px, 92vw)';
        dd.style.maxHeight = '80vh';
        dd.style.overflowY = 'auto';
      } else {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        dd.style.position = 'absolute';
        dd.style.top = (rect.bottom + scrollY + 6) + 'px';
        dd.style.right = (window.innerWidth - rect.right) + 'px';
        dd.style.left = 'auto';
      }
      dd.querySelectorAll('.sort-dropdown-item').forEach(item => {
        item.onclick = (ev) => {
          ev.stopPropagation();
          dd.remove(); // 先移除下拉菜单，释放主线程 UI
          requestAnimationFrame(() => {
            Students.setSortMode(item.dataset.sort);
          });
        };
      });
      setTimeout(() => {
        document.addEventListener('click', function closeSort(e) {
          if (!dd.contains(e.target) && !btn.contains(e.target)) {
            dd.remove();
            document.removeEventListener('click', closeSort);
          }
        });
      }, 0);
    };
  }

  async function exportClassDataToExcel() {
    try {
      if (typeof XLSX === 'undefined') {
        UI.toast('正在加载 Excel 库...', 'info', 2000);
        await (typeof loadXLSX === 'function' ? loadXLSX() : Promise.reject(new Error('loadXLSX 未定义')));
      }
    } catch (e) {
      UI.toast('Excel 库加载失败，请检查网络后重试', 'error'); return;
    }
    const students = Store.students.byClass(currentClassId);
    const groups = Store.groups.byClass(currentClassId);
    const cls = Store.classes.find(currentClassId);
    if (students.length === 0) {
      UI.toast('暂无学生数据可导出', 'info'); return;
    }
    const getGroupName = (gid) => (groups.find(g => g.id === gid) || {}).name || '未分组';
    const levelCfg = Store.levels.get(currentClassId);
    const rows = [
      ['姓名', '宠物名称', '小组', '徽章', '投喂总数', '鸡腿余额', '等级', '称号'],
      ...students.map(s => {
        const li = typeof calcLevelInfo === 'function' ? calcLevelInfo(s.fedLegs || 0, levelCfg) : { level: '-', title: '-' };
        return [
          s.name,
          (getPet(s.petType) || {}).name || s.petType || '',
          getGroupName(s.groupId || (s.groupIds && s.groupIds[0])),
          s.totalScore || 0,
          getStudentDisplayFedTotal(s),
          s.chickenLegs || 0,
          li.level,
          li.title || '',
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班级数据');
    XLSX.writeFile(wb, `${(cls && cls.name) || '班级'}_学生表现_${new Date().toISOString().slice(0, 10)}.xlsx`);
    UI.toast('导出成功', 'success');
  }

  /* ── Settings dropdown ── */
  function showSettingsDropdown(anchorEl) {
    const existing = document.getElementById('settings-dropdown');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.id = 'settings-dropdown';
    menu.className = 'settings-dropdown';
    menu.innerHTML = `
      <span class="sd-label">学生管理</span>
      <button class="sd-item" data-sd="add-student"><span class="sd-icon">➕</span>增加学生</button>
      <button class="sd-item" data-sd="batch-add"><span class="sd-icon">📋</span>批量添加</button>
      <button class="sd-item sd-item--danger" data-sd="reset-class"><span class="sd-icon">⚠️</span>重置班级所有学生数据</button>
      <div class="sd-sep"></div>
      <span class="sd-label">课堂工具</span>
      <button class="sd-item" data-sd="roll-call"><span class="sd-icon">🎲</span>随机点名</button>
      <button class="sd-item" data-sd="big-screen"><span class="sd-icon">🖥</span>大屏显示</button>
      <button class="sd-item" data-sd="lucky-wheel"><span class="sd-icon">🎡</span>奖励大转盘</button>
      <button class="sd-item" data-sd="remote-score"><span class="sd-icon">🎮</span>遥控加分</button>
      <button class="sd-item" data-sd="countdown"><span class="sd-icon">⏱️</span>倒计时</button>
      <div class="sd-sep"></div>
      <span class="sd-label">数据与老师设置</span>
      <button class="sd-item" data-sd="records"><span class="sd-icon">📝</span>积分记录</button>
      <button class="sd-item" data-sd="shop"><span class="sd-icon">🛒</span>小卖部</button>
      <button class="sd-item" data-sd="score-items-settings"><span class="sd-icon">📋</span>加分减分配置</button>
      <button class="sd-item" data-sd="level-settings"><span class="sd-icon">⚙️</span>升级设置</button>
      <button class="sd-item" data-sd="pet-hunger-settings"><span class="sd-icon">🍽️</span>宠物饥饿设置</button>
      <button class="sd-item" data-sd="data-center"><span class="sd-icon">📊</span>数据中心</button>
      <button class="sd-item" data-sd="pet-gallery"><span class="sd-icon">🐾</span>宠物图鉴</button>
    `;
    document.body.appendChild(menu);

    const rect = anchorEl.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Mobile: Fixed position, centered or bottom-anchored
      menu.style.position = 'fixed';
      menu.style.left = '50%';
      menu.style.transform = 'translateX(-50%)';
      menu.style.width = 'min(320px, 92vw)';
      menu.style.right = 'auto';

      // If the button is in the bottom bar (common for mobile)
      if (rect.top > window.innerHeight * 0.7) {
        menu.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
        menu.style.top = 'auto';
      } else {
        menu.style.top = (rect.bottom + 10) + 'px';
        menu.style.bottom = 'auto';
      }
    } else {
      // Desktop: Absolute position relative to body to follow scroll
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      menu.style.position = 'absolute';
      menu.style.top = (rect.bottom + scrollY + 6) + 'px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';
      menu.style.left = 'auto';
      menu.style.transform = 'none';
    }

    menu.querySelectorAll('.sd-item').forEach(item => {
      item.onclick = e => {
        e.stopPropagation();
        menu.remove();
        const action = item.dataset.sd;
        if (action === 'add-student') Students.showAddModal();
        else if (action === 'batch-add') Students.showBatchAdd();
        else if (action === 'reset-class') confirmResetClass();
        else if (action === 'roll-call') showRollCall();
        else if (action === 'big-screen') showBigScreen();
        else if (action === 'lucky-wheel') LuckyWheel.openConfigModal();
        else if (action === 'remote-score') showRemoteScore();
        else if (action === 'countdown') showCountdown();
        else if (action === 'records') switchTab('records');
        else if (action === 'shop') Shop.openAsModal();
        else if (action === 'score-items-settings') showScoreItemsSettings();
        else if (action === 'level-settings') showLevelSettings();
        else if (action === 'pet-hunger-settings') showPetHungerSettings();
        else if (action === 'data-center') showDataCenter();
        else if (action === 'pet-gallery') showPetGallery();
      };
    });

    setTimeout(() => {
      document.addEventListener('click', function _close(e) {
        if (!menu.contains(e.target) && !anchorEl.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', _close);
        }
      });
    }, 10);
  }

  /* ── 重置班级所有学生数据 ── */
  function confirmResetClass() {
    const students = Store.students.byClass(currentClassId);
    const cls = Store.classes.find(currentClassId);
    if (students.length === 0) {
      UI.toast('班级暂无学生，无需重置', 'info');
      return;
    }
    UI.confirm(
      `此操作将清空本班级「${cls ? cls.name : '当前班级'}」<b>所有 ${students.length} 名学生</b>的徽章、投喂进度、鸡腿、积分记录等数据，且<b>不可恢复</b>。确定要继续吗？`,
      () => {
        students.forEach(s => {
          Store.students.update(s.id, {
            totalScore: 0,
            fedLegs: 0,
            chickenLegs: 0,
            cumulativeFedLegs: 0,
            shopRedeemDebt: 0,
            medals: [],
            badges: [],
            petStickers: [],
            fullLevelPets: [],
          });
        });
        Store.records.removeByClass(currentClassId);
        UI.toast('已重置班级所有学生数据', 'success');
        Students.render();
        Records.render(currentClassId);
        renderGroupFilter();
      },
      '⚠️ 危险操作'
    );
  }

  /* ── 累计加分（用于积分榜 / 大屏 / 数据中心；含 cumulativeFedLegs） ── */
  function getCumulativeScore(s) {
    return getLeaderboardWelfareScore(s);
  }

  /** 光荣榜周期：日/周/月统计加分、扣分、兑换净值（不含投喂记录） */
  const HONOR_ROLL_RECORD_TYPES = ['add', 'deduct', 'redeem'];

  function getHonorRollPeriodRange(period) {
    const now = new Date();
    if (period === 'total') return { start: null, end: null, desc: '' };
    if (period === 'day') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        start,
        end,
        desc: `统计今日（${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 0:00 起）加分、扣分、兑换净值`,
      };
    }
    if (period === 'week') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setDate(end.getDate() + 7);
      return {
        start: d,
        end,
        desc: '统计本周（周一至周日 0:00 起）加分、扣分、兑换净值',
      };
    }
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return {
        start,
        end,
        desc: `统计本月（${now.getFullYear()}年${now.getMonth() + 1}月 1 日 0:00 起）加分、扣分、兑换净值`,
      };
    }
    return { start: null, end: null, desc: '' };
  }

  function getCumulativeScore(s) {
    return getLeaderboardWelfareScore(s);
  }

  function renderHonorRollList(period) {
    const students = Store.students.byClass(currentClassId);
    const levelCfg = Store.levels.get(currentClassId);
    const range = getHonorRollPeriodRange(period);
    const scoreLabel = period === 'total' ? '积分' : '本期';

    const descEl = document.getElementById('hr-period-desc');
    if (descEl) {
      descEl.textContent = period === 'total'
        ? '总榜按当前福利积分排序（投喂进度 + 鸡腿 − 兑换负债）'
        : range.desc;
    }

    const tabs = document.getElementById('hr-period-tabs');
    if (tabs) {
      tabs.querySelectorAll('.hr-tab').forEach(btn => {
        const active = btn.dataset.hrPeriod === period;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    const scoreMap = new Map();
    if (period === 'total') {
      students.forEach(s => scoreMap.set(s.id, getCumulativeScore(s)));
    } else {
      const allRecords = Store.records.byClass(currentClassId);
      const t0 = range.start ? range.start.getTime() : null;
      const t1 = range.end ? range.end.getTime() : null;

      allRecords.forEach(r => {
        if (!HONOR_ROLL_RECORD_TYPES.includes(r.type)) return;
        if (!r.studentId) return;
        const t = new Date(r.createdAt).getTime();
        if (t0 != null && t < t0) return;
        if (t1 != null && t >= t1) return;
        scoreMap.set(r.studentId, (scoreMap.get(r.studentId) || 0) + (Number(r.amount) || 0));
      });
      students.forEach(s => {
        if (!scoreMap.has(s.id)) scoreMap.set(s.id, 0);
      });
    }

    let progressTop5Set = new Set();
    const progressSlogans = ['🚀 飞速进步！', '⚡ 突飞猛进！', '🌟 潜力无限！', '🔥 势不可挡！', '💪 奋起直追！'];
    if (period === 'total') {
      const now = new Date();
      const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
      const allRecords = Store.records.byClass(currentClassId);
      const progressMap = new Map();
      allRecords.forEach(r => {
        if (!HONOR_ROLL_RECORD_TYPES.includes(r.type)) return;
        if (!r.studentId) return;
        const t = new Date(r.createdAt).getTime();
        if (t < weekAgo) return;
        progressMap.set(r.studentId, (progressMap.get(r.studentId) || 0) + (Number(r.amount) || 0));
      });
      const progressArr = [...progressMap.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      progressArr.forEach(([id]) => progressTop5Set.add(id));
    } else {
      const progressArr = [...scoreMap.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      progressArr.forEach(([id]) => progressTop5Set.add(id));
    }

    const sorted = [...students].sort((a, b) => {
      const sa = scoreMap.get(a.id) || 0;
      const sb = scoreMap.get(b.id) || 0;
      if (sb !== sa) return sb - sa;
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });

    const rankIcons = ['🥇', '🥈', '🥉'];
    let progressIdx = 0;
    const listHtml = sorted.length === 0
      ? '<div class="hr-empty">班级暂无学生数据</div>'
      : sorted.map((s, i) => {
        const li = calcLevelInfo(s.fedLegs || 0, levelCfg);
        const petSrc = getPetImg(s.petType, li.stage);
        const score = scoreMap.get(s.id) || 0;
        const rankDisplay = i < 3
          ? `<span class="hr-rank hr-rank-${i + 1}">${rankIcons[i]}</span>`
          : `<span class="hr-rank hr-rank-n">${i + 1}</span>`;
        const group = Store.groups.find(s.groupId || (s.groupIds && s.groupIds[0]));
        let progressBadge = '';
        if (progressTop5Set.has(s.id)) {
          progressBadge = `<span class="hr-progress-badge">${progressSlogans[progressIdx]}</span>`;
          progressIdx++;
        }
        return `
          <div class="hr-item${progressTop5Set.has(s.id) ? ' hr-item--progress' : ''}">
            ${rankDisplay}
            <img src="${petSrc}" class="hr-pet" alt=""
              onerror="this.outerHTML='<div class=hr-pet-emoji>${getPet(s.petType).emoji}</div>'">
            <div class="hr-info">
              <div class="hr-name">${s.name}${progressBadge}</div>
              <div class="hr-meta">Lv.${li.level} ${li.title}${group ? ' · ' + group.name : ''}</div>
            </div>
            <div class="hr-score-wrap">
              <span class="hr-score">🏆 ${score}</span>
              <span class="hr-score-label">${scoreLabel}</span>
            </div>
          </div>`;
      }).join('');

    document.getElementById('hr-list').innerHTML = listHtml;
  }

  /* ── Honor Roll ── */
  function showHonorRoll() {
    renderHonorRollList('total');
    document.getElementById('honor-roll').classList.add('open');
  }

  /* ══════════════════ GROUP RANK ══════════════════ */
  const HONOR_ROLL_RECORD_TYPES_GR = ['add', 'deduct'];

  function renderGroupRankList(period) {
    const groups = Store.groups.byClass(currentClassId);
    const students = Store.students.byClass(currentClassId);
    const range = getHonorRollPeriodRange(period);

    const descEl = document.getElementById('gr-period-desc');
    if (descEl) {
      descEl.textContent = period === 'total'
        ? '总榜：各小组成员当前福利积分之和'
        : (range.desc || '');
    }

    document.querySelectorAll('#gr-period-tabs .hr-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.grPeriod === period);
    });

    // 计算每个学生在该时段内的积分
    const studentScoreMap = new Map();
    if (period === 'total') {
      students.forEach(s => studentScoreMap.set(s.id, getCumulativeScore(s)));
    } else {
      const allRecords = Store.records.byClass(currentClassId);
      const t0 = range.start ? range.start.getTime() : null;
      const t1 = range.end ? range.end.getTime() : null;
      allRecords.forEach(r => {
        if (!HONOR_ROLL_RECORD_TYPES_GR.includes(r.type)) return;
        if (!r.studentId) return;
        const t = new Date(r.createdAt).getTime();
        if (t0 != null && t < t0) return;
        if (t1 != null && t >= t1) return;
        studentScoreMap.set(r.studentId, (studentScoreMap.get(r.studentId) || 0) + (Number(r.amount) || 0));
      });
    }

    // 汇总每个小组积分
    const groupScores = groups.map(g => {
      const members = students.filter(s => s.groupIds && s.groupIds.includes(g.id));
      const total = members.reduce((sum, s) => sum + (studentScoreMap.get(s.id) || 0), 0);
      const avg = members.length ? Math.round(total / members.length) : 0;
      return { g, members, total, avg };
    }).sort((a, b) => b.total - a.total || b.avg - a.avg);

    const rankIcons = ['🥇', '🥈', '🥉'];
    const listEl = document.getElementById('gr-list');
    if (groups.length === 0) {
      listEl.innerHTML = '<div class="hr-empty">班级暂无小组数据</div>';
      return;
    }

    listEl.innerHTML = groupScores.map((item, i) => {
      const { g, members, total, avg } = item;
      const rankHtml = i < 3
        ? `<span class="hr-rank hr-rank-${i + 1}">${rankIcons[i]}</span>`
        : `<span class="hr-rank">${i + 1}</span>`;
      const memberNames = members.map(s => s.name).join('、') || '暂无成员';
      const barMax = groupScores[0].total || 1;
      const barPct = Math.max(0, Math.min(100, Math.round((total / barMax) * 100)));
      return `
      <div class="hr-row gr-row">
        ${rankHtml}
        <div class="gr-group-info">
          <div class="gr-group-header">
            <span class="gr-dot" style="background:${g.color}"></span>
            <span class="gr-name">${g.name}</span>
            <span class="gr-member-count">${members.length}人</span>
          </div>
          <div class="gr-members">${memberNames}</div>
          <div class="hr-bar-wrap">
            <div class="hr-bar-fill" style="width:${barPct}%;background:${g.color}"></div>
          </div>
        </div>
        <div class="gr-scores">
          <div class="gr-total">🏆 ${total}</div>
          <div class="gr-avg">人均 ${avg}</div>
        </div>
      </div>`;
    }).join('');
  }

  function showGroupRank() {
    renderGroupRankList('total');
    document.getElementById('group-rank').classList.add('open');
  }

  document.getElementById('gr-close').onclick = () => {
    document.getElementById('group-rank').classList.remove('open');
  };

  document.getElementById('gr-period-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-gr-period]');
    if (btn) renderGroupRankList(btn.dataset.grPeriod);
  });

  /** 加分后联动产生的自动投喂记录（撤回加分时需一并撤销） */
  function isAutoFeedFromScore(r) {
    if (r.type !== 'feed') return false;
    const reason = r.reason || '';
    return reason.startsWith('加分 (') || reason.startsWith('遥控加分 (') || reason.startsWith('加分自动投喂 (') || reason.startsWith('挑战成功自动投喂 (');
  }

  /** 优先撤回「加分/扣分/兑换」；仅当最近记录全是投喂时才撤回最后一条投喂（避免 +2 分后被当成只撤回 1 次投喂） */
  function pickUndoTarget(allRecords) {
    const sorted = [...allRecords].sort((a, b) => {
      const tb = new Date(b.createdAt).getTime();
      const ta = new Date(a.createdAt).getTime();
      if (tb !== ta) return tb - ta;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
    const primary = sorted.find(r => r.type !== 'feed');
    return primary || sorted[0];
  }

  /* ── Undo last action ── */
  function undoLastAction() {
    const allRecords = Store.records.byClass(currentClassId);
    if (allRecords.length === 0) {
      UI.toast('没有可撤回的操作', 'warning');
      return;
    }
    const last = pickUndoTarget(allRecords);
    const typeMap = { add: '加分', deduct: '扣分', feed: '投喂', redeem: '兑换' };
    let desc = `${last.studentName} 的「${typeMap[last.type] || last.type}」操作（${last.amount > 0 ? '+' : ''}${last.amount}）`;
    if (last.type === 'add' && last.amount > 0) {
      const tAdd = new Date(last.createdAt).getTime();
      const feedCount = allRecords.filter(r =>
        r.studentId === last.studentId &&
        r.type === 'feed' &&
        isAutoFeedFromScore(r) &&
        new Date(r.createdAt).getTime() >= tAdd
      ).length;
      if (feedCount > 0) desc += `，含 ${feedCount} 次自动投喂`;
    }

    UI.confirm(`确认撤回：${desc}？`, () => {
      const sid = last.studentId;
      let s = Store.students.find(sid);
      if (!s) { UI.toast('找不到学生', 'error'); return; }

      if (last.type === 'add' && last.amount > 0) {
        const tAdd = new Date(last.createdAt).getTime();
        const feeds = allRecords
          .filter(r =>
            r.studentId === sid &&
            r.type === 'feed' &&
            isAutoFeedFromScore(r) &&
            new Date(r.createdAt).getTime() >= tAdd
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        for (const fr of feeds) {
          s = Store.students.find(sid);
          const fa = fr.fedAmount || 1;
          Store.students.update(sid, {
            fedLegs: Math.max(0, (s.fedLegs || 0) - fa),
            chickenLegs: (s.chickenLegs || 0) + fa,
          });
          Store.records.removeById(fr.id);
        }
        s = Store.students.find(sid);
        if (last.legsDeltaChicken != null && last.legsDeltaFed != null) {
          Store.students.update(sid, {
            chickenLegs: (s.chickenLegs || 0) - last.legsDeltaChicken,
            fedLegs: (s.fedLegs || 0) - last.legsDeltaFed,
          });
        } else {
          Store.students.update(sid, {
            chickenLegs: Math.max(0, (s.chickenLegs || 0) - (last.amount || 0)),
          });
        }
        Store.records.removeById(last.id);
      } else if (last.type === 'feed') {
        const fedAmount = last.fedAmount || 1;
        Store.students.update(sid, {
          fedLegs: Math.max(0, (s.fedLegs || 0) - fedAmount),
          chickenLegs: (s.chickenLegs || 0) + fedAmount,
        });
        Store.records.removeById(last.id);
      } else if (last.type === 'redeem') {
        const price = Math.abs(last.amount || 0);
        Store.students.update(sid, {
          shopRedeemDebt: Math.max(0, (s.shopRedeemDebt || 0) - price),
        });
        Store.records.removeById(last.id);
      } else if (last.legsDeltaChicken != null && last.legsDeltaFed != null) {
        Store.students.update(sid, {
          chickenLegs: (s.chickenLegs || 0) - last.legsDeltaChicken,
          fedLegs: (s.fedLegs || 0) - last.legsDeltaFed,
        });
        Store.records.removeById(last.id);
      } else {
        if (last.type === 'deduct' && last.amount < 0) {
          Store.students.update(sid, { chickenLegs: (s.chickenLegs || 0) + Math.abs(last.amount) });
        } else if (last.type === 'add' && last.amount > 0) {
          Store.students.update(sid, { chickenLegs: Math.max(0, (s.chickenLegs || 0) - (last.amount || 0)) });
        }
        Store.records.removeById(last.id);
      }

      UI.toast(`↩ 已撤回 ${last.studentName} 的操作`, 'success');
      Students.render();
      Records.render(currentClassId);
      renderGroupFilter();
    }, '确认撤回操作');
  }

  function switchTab(tab) {
    currentTab = tab;
    const backBtn = document.getElementById('btn-back-dashboard');
    if (backBtn) {
      backBtn.textContent = tab === 'students' ? '◀' : '◀ 返回';
      backBtn.title = tab === 'students' ? '返回班级列表' : '返回学生卡片';
    }
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
    if (tab === 'records') setTimeout(() => Records.render(currentClassId), 0);
    if (tab === 'groups') { Groups.render(); renderGroupFilter(); }
    if (tab === 'shop') Shop.render();
    if (tab === 'students') { Students.render(); renderGroupFilter(); }
  }

  /* ══════════════════ BIG SCREEN ══════════════════ */
  function showBigScreen() {
    const cls = Store.classes.find(currentClassId);
    const students = Store.students.byClass(currentClassId);
    const levelCfg = Store.levels.get(currentClassId);
    const sorted = [...students].sort((a, b) => getCumulativeScore(b) - getCumulativeScore(a));

    document.getElementById('bs-class-name').textContent = cls.name;

    // Stats
    const total = students.length;
    const totalScore = students.reduce((s, t) => s + getCumulativeScore(t), 0);
    const avg = total ? Math.round(totalScore / total) : 0;
    document.getElementById('bs-stats').innerHTML = `
      <div class="bs-stat"><div class="bs-stat-val">${total}</div><div class="bs-stat-label">学生人数</div></div>
      <div class="bs-stat"><div class="bs-stat-val">${totalScore}</div><div class="bs-stat-label">总积分</div></div>
      <div class="bs-stat"><div class="bs-stat-val">${avg}</div><div class="bs-stat-label">平均分</div></div>`;

    // Podium (top 3)
    const top3 = sorted.slice(0, 3);
    const ranks = ['🥇', '🥈', '🥉'];
    // Display order: 2nd, 1st, 3rd for podium effect
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
    document.getElementById('bs-podium').innerHTML = podiumOrder.map((s, i) => {
      const rankIdx = top3.indexOf(s);
      const li = calcLevelInfo(s.fedLegs || 0, levelCfg);
      return `
      <div class="bs-podium-item">
        <img src="${getPetImg(s.petType, li.stage)}" class="bs-podium-pet"
          onerror="this.style.display='none'">
        <div class="bs-podium-name">${s.name}</div>
        <div class="bs-podium-score">🏆 ${getCumulativeScore(s)}</div>
        <div class="bs-podium-rank">${ranks[rankIdx]}</div>
      </div>`;
    }).join('');

    // All cards
    document.getElementById('bs-cards').innerHTML = sorted.map(s => {
      const li = calcLevelInfo(s.fedLegs || 0, levelCfg);
      return `
      <div class="bs-card">
        <img src="${getPetImg(s.petType, li.stage)}" class="bs-card-pet"
          onerror="this.style.display='none'">
        <div class="bs-card-name">${s.name}</div>
        <div class="bs-card-score">🏆 ${getCumulativeScore(s)}</div>
        <div class="bs-card-level">Lv.${li.level} ${li.title}</div>
      </div>`;
    }).join('');

    document.getElementById('big-screen').classList.add('open');
  }

  document.getElementById('bs-close').onclick = () => {
    document.getElementById('big-screen').classList.remove('open');
  };

  /* ══════════════════ ROLL CALL ══════════════════ */
  let rollCallRunning = false;
  let rollCallTimer = null;
  let rcPickCount = 1; // 本次点名人数

  function showRollCall() {
    const overlay = document.getElementById('roll-call');
    overlay.classList.add('open');
    const students = Store.students.byClass(currentClassId);
    if (students.length === 0) {
      document.getElementById('rc-name').textContent = '没有学生';
      document.getElementById('rc-pet-img').src = '';
      return;
    }
    // show first student
    const s = students[0];
    const li = calcLevelInfo(s.fedLegs || 0, Store.levels.get(currentClassId));
    document.getElementById('rc-pet-img').src = getPetImg(s.petType, li.stage);
    document.getElementById('rc-name').textContent = s.name;
    document.getElementById('rc-result').textContent = '';
    // 绑定数量按钮
    document.getElementById('rc-count-minus').onclick = () => {
      rcPickCount = Math.max(1, rcPickCount - 1);
      document.getElementById('rc-count-val').textContent = rcPickCount;
    };
    document.getElementById('rc-count-plus').onclick = () => {
      rcPickCount = Math.min(students.length, rcPickCount + 1);
      document.getElementById('rc-count-val').textContent = rcPickCount;
    };
  }

  document.getElementById('rc-start').onclick = () => {
    const students = Store.students.byClass(currentClassId);
    if (students.length === 0) return;
    if (rollCallRunning) return;

    rollCallRunning = true;
    document.getElementById('rc-start').disabled = true;
    document.getElementById('rc-drum').classList.add('spinning');
    document.getElementById('rc-result').textContent = '';

    const levelCfg = Store.levels.get(currentClassId);
    let count = 0;
    const baseFrames = 28 + Math.floor(Math.random() * 22) - (rcPickCount - 1) * 5;
    const maxFrames = rcPickCount <= 3 ? 38 : 999;
    const totalFrames = Math.max(12, Math.min(baseFrames, maxFrames));
    // 初始速度随机，约 50-120ms
    let interval = 50 + Math.floor(Math.random() * 70);

    function frame() {
      const s = students[Math.floor(Math.random() * students.length)];
      const li = calcLevelInfo(s.fedLegs || 0, levelCfg);
      document.getElementById('rc-pet-img').src = getPetImg(s.petType, li.stage);
      document.getElementById('rc-name').textContent = s.name;
      count++;
      if (count < totalFrames) {
        // 前段随机波动速度，后段逐渐减慢
        if (count < totalFrames * 0.55) {
          // 快速滚动阶段：在基础速度上随机抖动 ±30ms
          interval = Math.max(40, interval + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 30));
        } else {
          // 减速阶段：速度逐渐变慢，并加入随机波动
          const slowFactor = 1.08 + Math.random() * 0.1;
          interval = Math.min(interval * slowFactor, 450);
        }
        rollCallTimer = setTimeout(frame, interval);
      } else {
        // 最终抽取 rcPickCount 人（不重复）
        const pool = [...students];
        const winners = [];
        const n = Math.min(rcPickCount, pool.length);
        for (let i = 0; i < n; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(idx, 1)[0]);
        }
        const last = winners[winners.length - 1];
        const wli = calcLevelInfo(last.fedLegs || 0, levelCfg);
        document.getElementById('rc-pet-img').src = getPetImg(last.petType, wli.stage);
        document.getElementById('rc-name').textContent = last.name;
        document.getElementById('rc-drum').classList.remove('spinning');
        const names = winners.map(w => w.name).join('、');
        document.getElementById('rc-result').textContent = `🎉 本次点名：${names}`;
        // 逐个显示获奖学生头像+名字
        const winnersEl = document.getElementById('rc-winners');
        winnersEl.innerHTML = '';
        winners.forEach(w => {
          const wli = calcLevelInfo(w.fedLegs || 0, levelCfg);
          const item = document.createElement('div');
          item.className = 'rc-winner-item';
          item.innerHTML = `<img src="${getPetImg(w.petType, wli.stage)}" class="rc-winner-img" onerror="this.style.display='none'"><div class="rc-winner-name">${w.name}</div>`;
          winnersEl.appendChild(item);
        });
        rollCallRunning = false;
        document.getElementById('rc-start').disabled = false;
      }
    }
    frame();
  };

  document.getElementById('rc-close').onclick = () => {
    clearTimeout(rollCallTimer);
    rollCallRunning = false;
    document.getElementById('rc-drum').classList.remove('spinning');
    document.getElementById('roll-call').classList.remove('open');
    document.getElementById('rc-start').disabled = false;
  };

  /* ══════════════════ COUNTDOWN TIMER ══════════════════ */
  let cdInterval = null;       // 倒计时定时器
  let cdRemaining = 0;         // 剩余秒数
  let cdTotal = 0;             // 总秒数
  let cdRunning = false;       // 是否正在运行
  let cdAudioCtx = null;       // 音频上下文（用于结束提示音）

  function cdFormat(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function cdBeep() {
    try {
      cdAudioCtx = cdAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = cdAudioCtx;
      // 连续三声提示音
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + i * 0.5;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.4, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.start(start);
        osc.stop(start + 0.45);
      }
    } catch (e) { /* 忽略音频错误 */ }
  }

  function cdUpdateDisplay() {
    const disp = document.getElementById('cd-display');
    if (disp) {
      disp.textContent = cdFormat(cdRemaining);
      // 最后 10 秒变红闪烁
      if (cdRunning && cdRemaining <= 10 && cdRemaining > 0) {
        disp.classList.add('cd-warning');
      } else {
        disp.classList.remove('cd-warning');
      }
      if (cdRemaining <= 0) {
        disp.classList.remove('cd-warning');
        disp.classList.add('cd-finished');
      } else {
        disp.classList.remove('cd-finished');
      }
    }
    // 更新进度环
    const ring = document.getElementById('cd-ring-progress');
    if (ring && cdTotal > 0) {
      const circumference = 2 * Math.PI * 130;
      const offset = circumference * (1 - cdRemaining / cdTotal);
      ring.style.strokeDashoffset = offset;
    }
  }

  function cdTick() {
    cdRemaining--;
    cdUpdateDisplay();
    if (cdRemaining <= 0) {
      clearInterval(cdInterval);
      cdInterval = null;
      cdRunning = false;
      cdBeep();
      const startBtn = document.getElementById('cd-start-pause');
      if (startBtn) startBtn.textContent = '▶ 开始';
      const disp = document.getElementById('cd-display');
      if (disp) disp.classList.add('cd-finished');
      if (typeof UI !== 'undefined') UI.toast('⏰ 时间到！', 'success', 3000);
    }
  }

  function cdStart() {
    if (cdRunning || cdRemaining <= 0) return;
    cdRunning = true;
    cdInterval = setInterval(cdTick, 1000);
    const btn = document.getElementById('cd-start-pause');
    if (btn) btn.textContent = '⏸ 暂停';
  }

  function cdPause() {
    cdRunning = false;
    if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
    const btn = document.getElementById('cd-start-pause');
    if (btn) btn.textContent = '▶ 继续';
  }

  function cdReset() {
    cdRunning = false;
    if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
    cdRemaining = cdTotal;
    cdUpdateDisplay();
    const btn = document.getElementById('cd-start-pause');
    if (btn) btn.textContent = '▶ 开始';
    const disp = document.getElementById('cd-display');
    if (disp) disp.classList.remove('cd-finished', 'cd-warning');
  }

  function cdSetTime(totalSec) {
    cdRunning = false;
    if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
    cdTotal = Math.max(0, Math.floor(totalSec));
    cdRemaining = cdTotal;
    cdUpdateDisplay();
    const btn = document.getElementById('cd-start-pause');
    if (btn) btn.textContent = '▶ 开始';
  }

  function showCountdown() {
    // 重置状态
    cdRunning = false;
    if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
    cdTotal = 60;
    cdRemaining = 60;

    const circumference = 2 * Math.PI * 130;
    const html = `
      <div class="cd-overlay-inner">
        <button class="cd-close" id="cd-close" title="关闭">✕</button>
        <div class="cd-ring-wrap">
          <svg class="cd-ring" viewBox="0 0 280 280">
            <circle cx="140" cy="140" r="130" class="cd-ring-bg"></circle>
            <circle cx="140" cy="140" r="130" class="cd-ring-fg" id="cd-ring-progress"
              stroke-dasharray="${circumference}" stroke-dashoffset="0"></circle>
          </svg>
          <div class="cd-display" id="cd-display">01:00</div>
        </div>
        <div class="cd-presets">
          <button class="cd-preset" data-sec="60">1分钟</button>
          <button class="cd-preset" data-sec="180">3分钟</button>
          <button class="cd-preset" data-sec="300">5分钟</button>
          <button class="cd-preset" data-sec="600">10分钟</button>
          <button class="cd-preset" data-sec="900">15分钟</button>
          <button class="cd-preset" data-sec="1800">30分钟</button>
        </div>
        <div class="cd-custom">
          <label>自定义：</label>
          <input type="number" id="cd-min" min="0" max="999" value="1" class="cd-num"> 分
          <input type="number" id="cd-sec" min="0" max="59" value="0" class="cd-num"> 秒
          <button class="btn-ghost btn-sm" id="cd-apply">设置</button>
        </div>
        <div class="cd-controls">
          <button class="cd-btn cd-btn-primary" id="cd-start-pause">▶ 开始</button>
          <button class="cd-btn cd-btn-ghost" id="cd-reset">↻ 重置</button>
        </div>
      </div>`;

    // 创建全屏覆盖层
    let overlay = document.getElementById('countdown-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'countdown-overlay';
    overlay.className = 'cd-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('open'));

    cdUpdateDisplay();

    // 预设按钮
    overlay.querySelectorAll('.cd-preset').forEach(btn => {
      btn.onclick = () => {
        const sec = Number(btn.dataset.sec);
        cdSetTime(sec);
        document.getElementById('cd-min').value = Math.floor(sec / 60);
        document.getElementById('cd-sec').value = sec % 60;
        overlay.querySelectorAll('.cd-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    // 自定义设置
    document.getElementById('cd-apply').onclick = () => {
      const min = Number(document.getElementById('cd-min').value) || 0;
      const sec = Number(document.getElementById('cd-sec').value) || 0;
      const total = min * 60 + sec;
      if (total <= 0) { if (typeof UI !== 'undefined') UI.toast('请设置有效的时间', 'warning'); return; }
      cdSetTime(total);
      overlay.querySelectorAll('.cd-preset').forEach(b => b.classList.remove('active'));
    };

    // 开始/暂停
    document.getElementById('cd-start-pause').onclick = () => {
      if (cdRemaining <= 0) { cdReset(); }
      if (cdRunning) cdPause();
      else cdStart();
    };

    // 重置
    document.getElementById('cd-reset').onclick = cdReset;

    // 关闭
    const closeFn = () => {
      cdRunning = false;
      if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    };
    document.getElementById('cd-close').onclick = closeFn;
    // 点击背景关闭（仅点击外层空白处）
    overlay.onclick = (e) => { if (e.target === overlay) closeFn(); };
  }

  /* ══════════════════ REMOTE SCORE ══════════════════ */
  let rsCurrentVal = 1;
  let rsSearchKw = '';
  const rsPending = new Map();

  function showRemoteScore() {
    rsPending.clear();
    rsCurrentVal = 1;
    rsSearchKw = '';
    const searchEl = document.getElementById('rs-student-search');
    if (searchEl) { searchEl.value = ''; searchEl.oninput = function () { rsSearchKw = this.value.trim().toLowerCase(); rsRenderStudentList(); }; }
    const customWrap = document.getElementById('rs-custom-wrap');
    if (customWrap) customWrap.style.display = '';
    rsRenderStudentList();
    rsRenderPending();

    // 分值快捷按钮
    document.querySelectorAll('.rs-score-btn').forEach(btn => {
      btn.onclick = () => {
        (btn.closest('.rs-score-btns')==null?void 0:btn.closest('.rs-score-btns')).querySelectorAll('.rs-score-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rsCurrentVal = Number(btn.dataset.v);
        document.getElementById('rs-custom-val').value = rsCurrentVal;
        // 同步更新已加入待操作列表中的分值
        rsRenderPending();
      };
    });

    document.getElementById('rs-custom-val').oninput = function () {
      rsCurrentVal = Number(this.value) || 0;
      document.querySelectorAll('.rs-score-btn').forEach(b => b.classList.remove('active'));
      rsRenderPending();
    };

    document.getElementById('rs-pending-clear').onclick = () => {
      rsPending.clear();
      rsRenderStudentList();
      rsRenderPending();
    };

    document.getElementById('rs-confirm-btn').onclick = rsConfirm;
    document.getElementById('remote-score').classList.add('open');
  }

  function rsRenderStudentList() {
    let students = Store.students.byClass(currentClassId);
    if (rsSearchKw) {
      students = students.filter(s =>
        (s.name || '').toLowerCase().includes(rsSearchKw) ||
        ((getPet(s.petType)==null?void 0:getPet(s.petType)).name || '').toLowerCase().includes(rsSearchKw)
      );
    }
    document.getElementById('rs-student-list').innerHTML = students.map(s => {
      const inPending = rsPending.has(s.id);
      const pendingVal = inPending ? rsPending.get(s.id).val : null;
      const pendingClass = inPending ? 'rs-student-btn--staged' : '';
      const badge = inPending
        ? `<span class="rs-staged-badge">${pendingVal > 0 ? '+' : ''}${pendingVal}</span>`
        : '';
      return `
      <div class="rs-student-btn ${pendingClass}" data-id="${s.id}">
        ${badge}
        <div class="rs-btn-name">${s.name}</div>
        <div class="rs-btn-score">🏅${s.totalScore} 🍗${s.chickenLegs}</div>
      </div>`;
    }).join('');

    document.querySelectorAll('.rs-student-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const s = Store.students.find(id);
        if (!s) return;
        if (rsPending.has(id)) {
          // 再次点击 → 取消
          rsPending.delete(id);
        } else {
          if (rsCurrentVal === 0) { UI.toast('请先选择操作值', 'warning'); return; }
          rsPending.set(id, { name: s.name, val: rsCurrentVal });
        }
        rsRenderStudentList();
        rsRenderPending();
      };
    });
  }

  function rsRenderPending() {
    const count = rsPending.size;
    const val = rsCurrentVal;
    const valStr = val > 0 ? `+${val}` : `${val}`;
    const confirmBtn = document.getElementById('rs-confirm-btn');
    const confirmText = document.getElementById('rs-confirm-text');
    document.getElementById('rs-pending-count').textContent = `${count} 人`;

    // 更新 pending 列表中已有的分值（分值可能已改变）
    rsPending.forEach((v, id) => { v.val = val; });

    if (count === 0) {
      document.getElementById('rs-pending-list').innerHTML =
        '<p class="rs-pending-empty">点击左侧学生加入列表</p>';
      confirmBtn.disabled = true;
      confirmText.textContent = '确认加分';
    } else {
      const isDeduct = val < 0;
      document.getElementById('rs-pending-list').innerHTML = [...rsPending.entries()].map(([id, v]) => `
        <div class="rs-pending-item">
          <span class="rs-pending-name">${v.name}</span>
          <span class="rs-pending-val ${v.val >= 0 ? 'add' : 'deduct'}">${v.val > 0 ? '+' : ''}${v.val}</span>
          <button class="rs-pending-remove" data-id="${id}">✕</button>
        </div>`).join('');
      document.querySelectorAll('.rs-pending-remove').forEach(btn => {
        btn.onclick = e => {
          e.stopPropagation();
          rsPending.delete(btn.dataset.id);
          rsRenderStudentList();
          rsRenderPending();
        };
      });
      confirmBtn.disabled = false;
      confirmText.textContent = `确认${isDeduct ? '扣' : '加'}分（${count} 人 ${valStr}）`;
      confirmBtn.className = `rs-confirm-btn${isDeduct ? ' rs-confirm-btn--deduct' : ''}`;
    }
  }

  function rsConfirm() {
    if (rsPending.size === 0) return;
    const reason = document.getElementById('rs-reason').value.trim() || '遥控加分';
    let count = 0;
    let skippedNoPet = 0;
    rsPending.forEach((v, id) => {
      const st = Store.students.find(id);
      if (!st) return;
      if (v.val !== 0 && !st.petType) {
        skippedNoPet++;
        return;
      }
      const after = Store.students.addScore(id, v.val, reason, v.val >= 0 ? 'add' : 'deduct');
      if (v.val !== 0 && !after) {
        skippedNoPet++;
        return;
      }
      if (v.val > 0) {
        Store.students.feedAllLegs(id, `遥控加分 (${reason})`);
      }
      count++;
    });
    if (skippedNoPet > 0) {
      UI.toast(`有 ${skippedNoPet} 名学生未领养萌宠，已跳过加分或扣分`, 'warning', 3500);
    }
    const val = rsCurrentVal;
    if (val > 0) {
      if (typeof Effects !== 'undefined' && Effects.playScoreRewardSound) Effects.playScoreRewardSound();
    } else if (val < 0) {
      if (typeof Effects !== 'undefined' && Effects.playScorePenaltySound) Effects.playScorePenaltySound();
    }
    UI.toast(`✅ 已为 ${count} 名学生${val >= 0 ? '加' : '扣'} ${Math.abs(val)} 分${val > 0 ? '并已投喂' : ''}`, 'success');
    rsPending.clear();
    rsRenderStudentList();
    rsRenderPending();
    Students.render();
    Records.render(currentClassId);
  }

  document.getElementById('rs-close').onclick = () => {
    document.getElementById('remote-score').classList.remove('open');
    rsPending.clear();
    Students.render();
    Records.render(currentClassId);
  };

  /* ── 加分减分配置（单击卡片弹框） ── */
  function escapeScoreAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r\n|\r|\n/g, ' ');
  }

  function showScoreItemsSettings() {
    const cfg = Store.scoreItems.get(currentClassId);
    const addItems = cfg.add || [];
    const deductItems = cfg.deduct || [];
    const defaultAdd = typeof SCORE_ADD_ITEMS !== 'undefined' ? JSON.parse(JSON.stringify(SCORE_ADD_ITEMS)) : [];
    const defaultDeduct = typeof SCORE_DEDUCT_ITEMS !== 'undefined' ? JSON.parse(JSON.stringify(SCORE_DEDUCT_ITEMS)) : [];

    const rowHtml = (list, type, idx) => {
      const it = list[idx] || { name: '', value: 1, icon: 'ri-star-line', py: '' };
      const numVal = Math.max(1, Math.min(9999, Number(it.value) || 1));
      return `<tr>
        <td><input type="text" class="si-item-name" data-type="${type}" data-idx="${idx}" value="${escapeScoreAttr(it.name || '')}" placeholder="项目名称"></td>
        <td><input type="number" class="si-item-value" data-type="${type}" data-idx="${idx}" value="${numVal}" min="1"></td>
        <td><input type="text" class="si-item-py" data-type="${type}" data-idx="${idx}" value="${escapeScoreAttr(it.py || '')}" placeholder="首字母搜索"></td>
        <td><button type="button" class="btn-ghost btn-sm si-item-del" data-type="${type}" data-idx="${idx}">删除</button><input type="hidden" class="si-item-icon" value="${escapeScoreAttr(it.icon || 'ri-star-line')}"></td>
      </tr>`;
    };

    const addRows = addItems.map((_, i) => rowHtml(addItems, 'add', i)).join('');
    const deductRows = deductItems.map((_, i) => rowHtml(deductItems, 'deduct', i)).join('');

    const body = `
      <p style="margin-bottom:1rem;color:var(--text-muted);font-size:.875rem">配置单击学生卡片时弹框中的加分项和扣分项，支持首字母搜索（如 cd 搜 迟到）。</p>
      <div class="si-config-section">
        <h4 style="margin:0 0 .5rem;font-size:.95rem">➕ 加分项</h4>
        <table class="si-config-table"><thead><tr><th>项目名称</th><th>分值</th><th>首字母</th><th></th></tr></thead>
        <tbody id="si-add-tbody">${addRows || rowHtml([], 'add', 0)}</tbody></table>
        <button type="button" class="btn-ghost btn-sm" id="si-add-add">+ 添加加分项</button>
      </div>
      <div class="si-config-section" style="margin-top:1.5rem">
        <h4 style="margin:0 0 .5rem;font-size:.95rem">➖ 扣分项</h4>
        <table class="si-config-table"><thead><tr><th>项目名称</th><th>分值</th><th>首字母</th><th></th></tr></thead>
        <tbody id="si-deduct-tbody">${deductRows || rowHtml([], 'deduct', 0)}</tbody></table>
        <button type="button" class="btn-ghost btn-sm" id="si-deduct-add">+ 添加扣分项</button>
      </div>
      <div class="modal-footer" style="margin-top:1rem">
        <button class="btn-ghost" id="si-reset-btn">恢复默认</button>
        <button class="btn-ghost" id="si-sync-btn" title="将当前配置覆盖到所有其他班级">一键同步其他班级</button>
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
        <button class="btn-primary" id="si-save-btn">保存</button>
      </div>`;

    UI.openModal('📋 加分减分配置', body, { wide: true });

    function collectItems(type) {
      const tbody = document.getElementById(`si-${type}-tbody`);
      if (!tbody) return [];
      return Array.from(tbody.querySelectorAll('tr')).map(tr => {
        const name = ((tr.querySelector('.si-item-name')==null?void 0:tr.querySelector('.si-item-name')).value==null?void 0:(tr.querySelector('.si-item-name')==null?void 0:tr.querySelector('.si-item-name')).value).trim() || '';
        const value = Math.max(1, Number((tr.querySelector('.si-item-value')==null?void 0:tr.querySelector('.si-item-value')).value) || 1);
        const py = ((tr.querySelector('.si-item-py')==null?void 0:tr.querySelector('.si-item-py')).value==null?void 0:(tr.querySelector('.si-item-py')==null?void 0:tr.querySelector('.si-item-py')).value).trim() || '';
        const icon = (tr.querySelector('.si-item-icon')==null?void 0:tr.querySelector('.si-item-icon')).value || 'ri-star-line';
        return { name, value, icon, py };
      }).filter(it => it.name);
    }

    document.getElementById('si-add-add').onclick = () => {
      const tbody = document.getElementById('si-add-tbody');
      const idx = tbody.querySelectorAll('tr').length;
      tbody.insertAdjacentHTML('beforeend', rowHtml([{ name: '', value: 1, py: '' }], 'add', idx));
      bindRowEvents();
    };
    document.getElementById('si-deduct-add').onclick = () => {
      const tbody = document.getElementById('si-deduct-tbody');
      const idx = tbody.querySelectorAll('tr').length;
      tbody.insertAdjacentHTML('beforeend', rowHtml([{ name: '', value: 1, py: '' }], 'deduct', idx));
      bindRowEvents();
    };

    function bindRowEvents() {
      const root = document.getElementById('modal-body');
      if (!root) return;
      root.querySelectorAll('.si-item-del').forEach(btn => {
        btn.onclick = () => { (btn.closest('tr')==null?void 0:btn.closest('tr')).remove(); };
      });
    }
    bindRowEvents();

    document.getElementById('si-reset-btn').onclick = () => {
      document.getElementById('si-add-tbody').innerHTML = defaultAdd.map((_, i) => rowHtml(defaultAdd, 'add', i)).join('') || rowHtml([], 'add', 0);
      document.getElementById('si-deduct-tbody').innerHTML = defaultDeduct.map((_, i) => rowHtml(defaultDeduct, 'deduct', i)).join('') || rowHtml([], 'deduct', 0);
      bindRowEvents();
    };

    document.getElementById('si-sync-btn').onclick = () => {
      const add = collectItems('add');
      const deduct = collectItems('deduct');
      if (add.length === 0 && deduct.length === 0) return;
      const others = Store.classes.all().filter(c => c.id !== currentClassId);
      if (others.length === 0) { UI.toast('没有其他班级可同步', 'info'); return; }
      UI.confirm(`确定要将当前「加减分项」同步到其他 <b>${others.length}</b> 个班级吗？<br><small style="color:var(--text-muted)">这会覆盖这些班级原有的配置。</small>`, () => {
        others.forEach(c => Store.scoreItems.set(c.id, { add, deduct }));
        Store.forceSync();
        UI.toast(`✅ 已同步到 ${others.length} 个班级`, 'success');
      }, '一键同步配置');
    };

    document.getElementById('si-save-btn').onclick = () => {
      const add = collectItems('add');
      const deduct = collectItems('deduct');
      if (add.length === 0 && deduct.length === 0) {
        UI.toast('请至少保留一个加分或扣分项', 'warning');
        return;
      }
      window._isSavingConfig = true;
      Store.scoreItems.set(currentClassId, { add: add.length ? add : defaultAdd, deduct: deduct.length ? deduct : defaultDeduct });
      Store.forceSync();
      UI.closeModal();
      UI.toast('配置已保存，单击卡片时将使用新配置', 'success');
      setTimeout(() => { window._isSavingConfig = false; }, 500);
    };
  }

  /* ══════════════════ LEVEL SETTINGS ══════════════════ */
  function showLevelSettings() {
    const cfg = Store.levels.get(currentClassId);
    UI.openModal('⚙️ 升级设置', levelSettingsHtml(cfg), { wide: true });
    document.getElementById('save-levels-btn').onclick = saveLevels;
    document.getElementById('sync-levels-btn').onclick = () => {
      const data = _collectCurrentLevelRows();
      const others = Store.classes.all().filter(c => c.id !== currentClassId);
      if (others.length === 0) { UI.toast('没有其他班级可同步', 'info'); return; }
      UI.confirm(`确定要将当前「升级设置」同步到其他 <b>${others.length}</b> 个班级吗？`, () => {
        others.forEach(c => Store.levels.set(c.id, data));
        Store.forceSync();
        UI.toast(`✅ 已同步到 ${others.length} 个班级`, 'success');
      }, '一键同步升级设置');
    };
    document.getElementById('reset-levels-btn').onclick = () => {
      const defaults = JSON.parse(JSON.stringify(DEFAULT_LEVELS));
      document.getElementById('level-settings-body').innerHTML = levelSettingsRows(defaults);
    };
  }

  function levelSettingsHtml(cfg) {
    return `
    <p style="margin-bottom:.75rem;color:var(--text-muted);font-size:.875rem">
      设置各等级所需的<b>累计投喂🍗次数</b>、称号及对应宠物阶段（1-10），共10级满级。数值需从低到高排列。
    </p>
    <table class="level-settings-table">
      <thead><tr><th>等级</th><th>累计投喂🍗</th><th>称号</th><th>宠物阶段</th></tr></thead>
      <tbody id="level-settings-body">${levelSettingsRows(cfg)}</tbody>
    </table>
    <div class="modal-footer">
      <button class="btn-ghost" id="reset-levels-btn">恢复默认</button>
      <button class="btn-ghost" id="sync-levels-btn" title="将当前配置覆盖到所有其他班级">一键同步其他班级</button>
      <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
      <button class="btn-primary" id="save-levels-btn">保存</button>
    </div>`;
  }

  function levelSettingsRows(cfg) {
    return cfg.map((lv, i) => `
      <tr>
        <td style="font-weight:700">Lv.${lv.level}</td>
        <td><input type="number" class="ls-min-score" data-idx="${i}" value="${lv.minFeeds !== undefined ? lv.minFeeds : (lv.minScore || 0)}" min="0"></td>
        <td><input type="text" class="ls-title" data-idx="${i}" value="${lv.title}" style="width:120px"></td>
        <td>
          <select class="ls-stage" data-idx="${i}">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => `<option value="${s}" ${lv.stage === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');
  }

  function _collectCurrentLevelRows() {
    const rows = document.querySelectorAll('.ls-min-score');
    const data = [];
    rows.forEach(el => {
      const i = Number(el.dataset.idx);
      const minFeeds = Number(el.value) || 0;
      const title = ((document.querySelector(`.ls-title[data-idx="${i}"]`)==null?void 0:document.querySelector(`.ls-title[data-idx="${i}"]`)).value==null?void 0:(document.querySelector(`.ls-title[data-idx="${i}"]`)==null?void 0:document.querySelector(`.ls-title[data-idx="${i}"]`)).value).trim() || '';
      const stage = Number((document.querySelector(`.ls-stage[data-idx="${i}"]`)==null?void 0:document.querySelector(`.ls-stage[data-idx="${i}"]`)).value) || (i + 1);
      data.push({ level: i + 1, minFeeds, minScore: minFeeds, title, stage });
    });
    return data;
  }

  function saveLevels() {
    const data = _collectCurrentLevelRows();
    window._isSavingConfig = true;
    Store.levels.set(currentClassId, data);
    Store.forceSync();
    UI.closeModal();
    UI.toast('升级设置已保存', 'success');
    Students.render();
    setTimeout(() => { window._isSavingConfig = false; }, 500);
  }

  function showPetHungerSettings() {
    const cfg = Store.hunger.get(currentClassId);
    const def = typeof getDefaultPetHungerConfig === 'function'
      ? getDefaultPetHungerConfig()
      : { hungryAfterDays: 3, criticalAfterDays: 7, starveAfterDays: 30 };
    const hungry = cfg.hungryAfterDays || def.hungryAfterDays;
    const critical = cfg.criticalAfterDays || def.criticalAfterDays;
    const starve = cfg.starveAfterDays || def.starveAfterDays;
    UI.openModal('🍽️ 宠物饥饿设置', `
      <p style="margin-bottom:1rem;color:var(--text-muted);font-size:.875rem;line-height:1.5">
        默认开启。按「上一次投喂/加分」起的自然日计算；任意加分或投喂都会刷新计时。
        <b>老数据</b>会尽量按入学时间、积分记录推断上次投喂；若完全没有记录，则按「已超过好饿天数」显示饥饿，避免永远不饿。
        三档需递增：好饿 → 濒临饿死 → 彻底饿死（须重新领养）。
        <b>寒暑假</b>可开启下方「长假模式」，期间不计饥饿、宠物不会饿死，开学后关闭即可按原规则继续。
      </p>
      <div class="modal-form">
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;margin-bottom:1rem">
          <input type="checkbox" id="hunger-enabled" ${cfg.enabled ? 'checked' : ''}>
          <span style="font-weight:700">启用宠物饥饿</span>
        </label>
        <label style="display:flex;align-items:flex-start;gap:.5rem;cursor:pointer;margin-bottom:1rem;padding:.65rem .75rem;background:var(--bg-soft,#f5f3ff);border-radius:var(--radius);border:1px solid var(--border)">
          <input type="checkbox" id="hunger-vacation-mode" ${cfg.vacationMode ? 'checked' : ''} style="margin-top:.2rem">
          <span style="font-size:.86rem;line-height:1.45">
            <strong>长假模式</strong>（寒暑假、停课等）<br>
            <span style="color:var(--text-muted);font-weight:500">开启后本班所有宠物<strong>不进入</strong>好饿/濒临饿死/饿死；关闭后立即按上面天数规则继续计算（放假前若已饥饿，关闭后仍会按未投喂天数累计）。</span>
          </span>
        </label>
        <div class="form-field">
          <label>第几天开始好饿（显示：主人，我好饿呀~）</label>
          <input type="number" id="hunger-hungry-days" class="form-input" min="1" max="365" value="${hungry}">
        </div>
        <div class="form-field">
          <label>第几天濒临饿死（显示：主人，我濒临饿死啦！；须大于上一项）</label>
          <input type="number" id="hunger-critical-days" class="form-input" min="2" max="998" value="${critical}">
        </div>
        <div class="form-field">
          <label>第几天彻底饿死（须大于上一项；需重新领养）</label>
          <input type="number" id="hunger-starve-days" class="form-input" min="3" max="999" value="${starve}">
        </div>
        <div class="hunger-clear-wrap" style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border)">
          <p style="margin:0 0 .6rem;font-size:.82rem;color:var(--text-muted);line-height:1.5">
            一键将本班<strong>所有有宠物</strong>的学生视为刚刚获得投喂/加分，饥饿计时从此时重新开始（清除好饿、濒临饿死、饿死状态；已饿死界面会恢复为正常宠物，无需重新领养）。
          </p>
          <button type="button" class="btn-ghost btn-sm" id="clear-all-hunger-btn">清除所有宠物饥饿状态</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
        <button class="btn-primary" id="save-hunger-btn">保存</button>
      </div>`, { wide: true });
    document.getElementById('clear-all-hunger-btn').onclick = () => {
      const list = Store.students.byClass(currentClassId).filter(s => s.petType);
      if (list.length === 0) {
        UI.toast('本班当前没有带宠物的学生', 'info');
        return;
      }
      UI.confirm(
        `确定将 ${list.length} 名有宠学生的饥饿计时全部归零吗？（视为刚投喂/刚加分）`,
        () => {
          const now = new Date().toISOString();
          list.forEach(s => Store.students.update(s.id, { lastPetFedAt: now }));
          Store.forceSync();
          Students.render();
          UI.toast(`已清除 ${list.length} 名学生的饥饿状态`, 'success');
        },
        '清除饥饿状态'
      );
    };
    document.getElementById('save-hunger-btn').onclick = () => {
      let hungryAfterDays = parseInt(document.getElementById('hunger-hungry-days').value, 10);
      let criticalAfterDays = parseInt(document.getElementById('hunger-critical-days').value, 10);
      let starveAfterDays = parseInt(document.getElementById('hunger-starve-days').value, 10);
      const d = typeof getDefaultPetHungerConfig === 'function' ? getDefaultPetHungerConfig() : {};
      if (!hungryAfterDays || hungryAfterDays < 1) hungryAfterDays = d.hungryAfterDays || 3;
      if (!criticalAfterDays || criticalAfterDays < 2) criticalAfterDays = d.criticalAfterDays || 7;
      if (!starveAfterDays || starveAfterDays < 3) starveAfterDays = d.starveAfterDays || 30;
      if (criticalAfterDays <= hungryAfterDays) criticalAfterDays = hungryAfterDays + 1;
      if (starveAfterDays <= criticalAfterDays) starveAfterDays = criticalAfterDays + 1;
      window._isSavingConfig = true;
      Store.hunger.set(currentClassId, {
        enabled: document.getElementById('hunger-enabled').checked,
        vacationMode: document.getElementById('hunger-vacation-mode').checked,
        hungryAfterDays,
        criticalAfterDays,
        starveAfterDays,
      });
      Store.forceSync();
      UI.closeModal();
      UI.toast('饥饿设置已保存', 'success');
      Students.render();
      setTimeout(() => { window._isSavingConfig = false; }, 500);
    };
  }

  /* ══════════════════ DATA CENTER ══════════════════ */
  function showDataCenter() {
    const students = Store.students.byClass(currentClassId);
    const records = Store.records.byClass(currentClassId);
    const levelCfg = Store.levels.get(currentClassId);
    const total = students.length;
    const totalScore = students.reduce((s, t) => s + getCumulativeScore(t), 0);
    const avg = total ? Math.round(totalScore / total) : 0;
    const sorted = [...students].sort((a, b) => getCumulativeScore(b) - getCumulativeScore(a));
    const maxScore = sorted[0] ? getCumulativeScore(sorted[0]) : 0;
    const totalChicken = students.reduce((s, t) => s + t.chickenLegs, 0);

    const topList = sorted.slice(0, 10).map((s, i) => {
      const li = calcLevelInfo(s.fedLegs || 0, levelCfg);
      const score = getCumulativeScore(s);
      const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const rankClass = i === 0 ? 'gold' : (i === 1 ? 'silver' : (i === 2 ? 'bronze' : ''));
      return `
      <div class="dc-top-item">
        <div class="dc-top-rank ${rankClass}">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
        <img src="${getPetImg(s.petType, li.stage)}" class="dc-top-img" onerror="this.style.display='none'">
        <div class="dc-top-info">
          <div class="dc-top-name">${s.name}</div>
          <div class="dc-top-score">🏆 ${score} 分　Lv.${li.level} ${li.title}</div>
        </div>
        <div class="dc-top-bar-wrap">
          <div class="dc-top-bar"><div class="dc-top-bar-fill" style="width:${pct}%"></div></div>
        </div>
      </div>`;
    }).join('');

    /* ── 分组排名（小组总积分）── */
    const groups = Store.groups.byClass(currentClassId);
    const groupScores = groups.map(g => {
      const members = students.filter(s => s.groupIds && s.groupIds.includes(g.id));
      const groupTotal = members.reduce((sum, s) => sum + getCumulativeScore(s), 0);
      return { group: g, members, total: groupTotal, avg: members.length ? Math.round(groupTotal / members.length) : 0 };
    }).filter(x => x.members.length > 0);
    groupScores.sort((a, b) => b.total - a.total);
    const maxGroupScore = groupScores[0] ? groupScores[0].total : 1;

    const groupRankHtml = groupScores.length
      ? groupScores.map((gs, i) => {
        const pct = maxGroupScore > 0 ? Math.round((gs.total / maxGroupScore) * 100) : 0;
        const rankClass = i === 0 ? 'gold' : (i === 1 ? 'silver' : (i === 2 ? 'bronze' : ''));
        return `
          <div class="dc-top-item dc-group-item" style="border-left:3px solid ${gs.group.color}">
            <div class="dc-top-rank ${rankClass}">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
            <div class="dc-top-info" style="flex:1">
              <div class="dc-top-name">${gs.group.name}</div>
              <div class="dc-top-score">🏆 ${gs.total} 分（${gs.members.length}人，人均 ${gs.avg}）</div>
            </div>
            <div class="dc-top-bar-wrap" style="min-width:100px">
              <div class="dc-top-bar"><div class="dc-top-bar-fill" style="width:${pct}%"></div></div>
            </div>
          </div>`;
      }).join('')
      : '<p style="color:var(--text-muted);text-align:center;padding:1rem">暂无小组数据，请先在「小组」中创建小组并分配成员</p>';

    UI.openModal('📊 数据中心', `
      <div class="data-center-grid">
        <div class="dc-stat-card"><div class="dc-stat-val">${total}</div><div class="dc-stat-label">班级学生</div></div>
        <div class="dc-stat-card"><div class="dc-stat-val">${totalScore}</div><div class="dc-stat-label">总积分</div></div>
        <div class="dc-stat-card"><div class="dc-stat-val">${avg}</div><div class="dc-stat-label">人均积分</div></div>
        <div class="dc-stat-card"><div class="dc-stat-val">${records.length}</div><div class="dc-stat-label">记录总数</div></div>
      </div>
      <h4 style="margin-bottom:.75rem;font-weight:700">🏆 积分排行榜</h4>
      <div class="dc-top-list">${topList || '<p style="color:var(--text-muted);text-align:center;padding:1rem">暂无数据</p>'}</div>
      <h4 style="margin:1.25rem 0 .75rem;font-weight:700">👥 分组排名</h4>
      <div class="dc-top-list dc-group-list">${groupRankHtml}</div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`, { wide: true });
  }

  return { init, switchTab, renderGroupFilter };

  /* ══════════════════ 宠物图鉴（滑动进度条预览）══════════════════ */
  function showPetGallery() {
    let overlay = document.getElementById('pet-gallery-overlay');
    if (overlay) {
      overlay.classList.add('open');
      _pgReset(overlay);
      return;
    }

    overlay = document.createElement('div');
    overlay.id = 'pet-gallery-overlay';
    overlay.className = 'fullscreen-overlay pg-overlay open';
    overlay.innerHTML = `
      <div class="pg-header">
        <div class="pg-title-wrap">
          <span class="pg-icon">🐾</span>
          <h2 class="pg-title">宠物图鉴</h2>
          <span class="pg-subtitle">共 ${PET_TYPES.length} 种宠物 · 滑动预览各等级形态</span>
        </div>
        <div class="pg-header-right">
          <label class="pg-search-wrap">
            <span class="pg-search-icon">🔍</span>
            <input type="text" id="pg-search" class="pg-search-input" placeholder="搜索宠物名称..." autocomplete="off">
          </label>
          <button class="pg-close" id="pg-close">✕ 关闭</button>
        </div>
      </div>
      <div class="pg-slider-bar">
        <div class="pg-lv-info">
          <span class="pg-lv-num" id="pg-lv-num">Lv.1</span>
          <span class="pg-lv-title-text" id="pg-lv-title">萌新学员</span>
        </div>
        <div class="pg-slider-wrap">
          <span class="pg-slider-label">Lv.1</span>
          <input type="range" id="pg-slider" class="pg-slider" min="1" max="10" step="1" value="1">
          <span class="pg-slider-label">Lv.10</span>
        </div>
        <div class="pg-lv-dots" id="pg-lv-dots">
          ${Array.from({ length: 10 }, (_, i) => `<span class="pg-dot${i === 0 ? ' active' : ''}" data-lv="${i + 1}" title="Lv.${i + 1}"></span>`).join('')}
        </div>
      </div>
      <div class="pg-body" id="pg-body"></div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#pg-close').onclick = () => overlay.classList.remove('open');
    overlay._pgEsc = e => { if (e.key === 'Escape') overlay.classList.remove('open'); };
    document.addEventListener('keydown', overlay._pgEsc);

    let currentLv = 1;
    const slider = overlay.querySelector('#pg-slider');
    const lvNumEl = overlay.querySelector('#pg-lv-num');
    const lvTitleEl = overlay.querySelector('#pg-lv-title');
    const dotsEl = overlay.querySelector('#pg-lv-dots');

    function updateLevel(lv) {
      currentLv = lv;
      slider.value = lv;
      var lvCfg = (typeof DEFAULT_LEVELS !== 'undefined' ? DEFAULT_LEVELS : []).find(l => l.level === lv) || {};
      lvNumEl.textContent = 'Lv.' + lv;
      lvTitleEl.textContent = lvCfg.title || '';
      var pct = ((lv - 1) / 9) * 100;
      slider.style.setProperty('--pg-pct', pct + '%');
      dotsEl.querySelectorAll('.pg-dot').forEach(d => d.classList.toggle('active', +d.dataset.lv === lv));
    }

    function updateImages(lv) {
      var cards = overlay.querySelectorAll('.pg-card[data-pet-type]');
      var lvCfg = (typeof DEFAULT_LEVELS !== 'undefined' ? DEFAULT_LEVELS : []).find(function(l){ return l.level === lv; }) || {};
      var i = 0;
      function next() {
        if (i >= cards.length || currentLv !== lv) return;
        var card = cards[i];
        var pt = card.dataset.petType;
        var img = card.querySelector('.pg-card-img');
        var badge = card.querySelector('.pg-card-lv-badge');
        var titleEl = card.querySelector('.pg-card-title');
        if (img) { img.src = getPetImg(pt, lv); img.style.display = ''; }
        var fb = card.querySelector('.pg-card-fallback');
        if (fb) fb.style.display = 'none';
        if (badge) badge.textContent = 'Lv.' + lv;
        if (titleEl) titleEl.textContent = lvCfg.title || ('等级 ' + lv);
        i++;
        if (i < cards.length) setTimeout(next, 0);
      }
      next();
    }

    slider.addEventListener('input', function() {
      updateLevel(+slider.value);
    });
    slider.addEventListener('change', function() {
      updateImages(+slider.value);
    });
    dotsEl.addEventListener('click', e => {
      const dot = e.target.closest('.pg-dot');
      if (dot) { updateLevel(+dot.dataset.lv); updateImages(+dot.dataset.lv); }
    });
    overlay.querySelector('#pg-search').addEventListener('input', function () {
      _pgRenderCards(overlay, currentLv);
    });

    slider.style.setProperty('--pg-pct', '0%');
    _pgRenderCards(overlay, 1);
  }

  function _pgReset(overlay) {
    overlay.querySelector('#pg-search').value = '';
    const slider = overlay.querySelector('#pg-slider');
    if (slider) { slider.value = 1; slider.style.setProperty('--pg-pct', '0%'); }
    overlay.querySelector('#pg-lv-num').textContent = 'Lv.1';
    const lvCfg = (typeof DEFAULT_LEVELS !== 'undefined' ? DEFAULT_LEVELS : []).find(l => l.level === 1) || {};
    overlay.querySelector('#pg-lv-title').textContent = lvCfg.title || '';
    overlay.querySelectorAll('.pg-dot').forEach((d, i) => d.classList.toggle('active', i === 0));
    _pgRenderCards(overlay, 1);
  }

  function _pgRenderCards(overlay, currentLv) {
    const body = overlay.querySelector('#pg-body');
    const searchVal = (overlay.querySelector('#pg-search').value || '').trim().toLowerCase();
    const filtered = PET_TYPES.filter(p =>
      !searchVal || p.name.toLowerCase().includes(searchVal) || p.type.toLowerCase().includes(searchVal)
    );

    if (filtered.length === 0) {
      body.innerHTML = '<div class="pg-empty">😔 没有找到匹配的宠物</div>';
      return;
    }

    const lvCfg = (typeof DEFAULT_LEVELS !== 'undefined' ? DEFAULT_LEVELS : []).find(l => l.level === currentLv) || {};
    const lvTitle = lvCfg.title || ('等级 ' + currentLv);

    body.innerHTML = filtered.map(p => {
      const imgSrc = getPetImg(p.type, currentLv);
      return `
        <div class="pg-card" data-pet-type="${p.type}">
          <div class="pg-card-img-wrap">
            <div class="pg-card-lv-badge">Lv.${currentLv}</div>
            <img src="${imgSrc}" alt="${p.name}" class="pg-card-img"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="pg-card-fallback" style="display:none">${p.emoji}</div>
          </div>
          <div class="pg-card-info">
            <div class="pg-card-name">${p.name}</div>
            <div class="pg-card-title">${lvTitle}</div>
          </div>
        </div>`;
    }).join('');

    body.querySelectorAll('.pg-card').forEach(card => {
      card.addEventListener('click', () => {
        const pet = PET_TYPES.find(p => p.type === card.dataset.petType);
        if (pet) _pgShowDetail(pet, currentLv);
      });
    });
  }

  function _pgShowDetail(pet, highlightLv) {
    const levelCfg = (typeof Store !== 'undefined' && Store.levels) ? Store.levels.get(currentClassId) : DEFAULT_LEVELS;
    const rows = Array.from({ length: 10 }, (_, i) => {
      const lv = i + 1;
      const imgSrc = getPetImg(pet.type, lv);
      const lvCfg = levelCfg.find(l => l.level === lv) || {};
      const lvTitle = lvCfg.title || ('等级 ' + lv);
      const minFeeds = lvCfg.minFeeds || 0;
      const isHL = lv === highlightLv;
      return `
        <div class="pg-detail-cell${isHL ? ' pg-detail-cell--active' : ''}">
          <div class="pg-detail-lv-badge${isHL ? ' active' : ''}">Lv.${lv}</div>
          <img src="${imgSrc}" alt="${pet.name} Lv.${lv}" class="pg-detail-img"
            onclick="this.requestFullscreen && this.requestFullscreen()"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="pg-detail-fallback" style="display:none">${pet.emoji}</div>
          <div class="pg-detail-info">
            <div class="pg-detail-title">${lvTitle}</div>
            <div class="pg-detail-feeds">🍗 ${minFeeds}+ 次投喂</div>
          </div>
        </div>`;
    }).join('');

    const html = `
      <div class="pg-detail-header">
        <span class="pg-detail-emoji">${pet.emoji}</span>
        <div>
          <div class="pg-detail-name">${pet.name}</div>
          <div class="pg-detail-sub">点击图片可全屏预览形态</div>
        </div>
      </div>
      <div class="pg-detail-grid">${rows}</div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`;
    UI.openModal('🐾 ' + pet.name + ' · 全等级预览', html, { wide: true });
  }

})();
