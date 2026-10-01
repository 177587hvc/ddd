/* ═══════════════════════ STUDENTS.JS ═══════════════════════
   Student list, cards, CRUD, filters, batch ops
═══════════════════════════════════════════════════════════ */

const Students = (() => {

  let currentClassId = null;
  let selectedIds = new Set();
  let isSelectMode = false;
  let filters = { name: '', pet: '', group: '', minScore: '', maxScore: '' };
  let openDropdownId = null;
  let _activeGroupFilter = null; // null=all, '__none__'=ungrouped, groupId=specific group
  /** 与 ClassView 排序下拉一致：default | joinOrder | nameInitial | leaderboard | progress | hungerDeadFirst | hungerCriticalFirst */
  let _sortMode = 'default';
  /** 座位调整模式：开启后卡片可拖拽换位 */
  let _seatEditMode = false;
  
  // 图片代理缓存，避免重复请求同一张图片
  const imageProxyCache = new Map();
  
  // 通过代理加载图片（带缓存）
  async function loadImageViaProxy(imageUrl) {
    // 检查缓存
    if (imageProxyCache.has(imageUrl)) {
      return imageProxyCache.get(imageUrl);
    }
    
    const apiUrl = window.location.pathname.includes('/backend/') 
      ? '/backend/api.php?action=proxyImage'
      : new URL('/backend/api.php?action=proxyImage', window.location.origin).href.replace(window.location.origin, '');
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.ok && data.data) {
        // 缓存 base64 数据
        imageProxyCache.set(imageUrl, data.data);
        return data.data;
      } else {
        throw new Error(data.msg || '加载失败');
      }
    } catch (err) {
      console.error('[图片代理] 加载失败:', imageUrl, err);
      return null;
    }
  }

  function setSearchFilter(val) {
    filters.name = (val || '').toLowerCase();
    render();
  }

  function setGroupFilter(groupId) {
    _activeGroupFilter = groupId || null;
    render();
  }

  function getGroupFilter() {
    return _activeGroupFilter;
  }

  function _sortStorageKey(classId) {
    return `students.sortMode.${classId || currentClassId || 'global'}`;
  }

  function _loadSortMode(classId) {
    try {
      const val = localStorage.getItem(_sortStorageKey(classId));
      const allowed = new Set(['default', 'joinOrder', 'nameInitial', 'leaderboard', 'progress', 'hungerDeadFirst', 'hungerCriticalFirst']);
      return val && allowed.has(val) ? val : 'default';
    } catch (e) {
      return 'default';
    }
  }

  function _saveSortMode(mode) {
    try {
      localStorage.setItem(_sortStorageKey(), mode);
    } catch (e) { /* ignore */ }
  }

  function getSortMode() {
    return _sortMode;
  }

  function setSortMode(mode) {
    const allowed = new Set(['default', 'joinOrder', 'nameInitial', 'leaderboard', 'progress', 'hungerDeadFirst', 'hungerCriticalFirst']);
    _sortMode = allowed.has(mode) ? mode : 'default';
    _saveSortMode(_sortMode);
    render({ skipFilters: true });
  }

  /** 班级列表筛选后的排序（不改变 Store 顺序） */
  function applySortToFiltered(list) {
    if (!list || list.length < 2) return list;
    const levelCfg = Store.levels.get(currentClassId) || DEFAULT_LEVELS;
    const hungerCfg = Store.hunger.get(currentClassId);
    
    const welfare = s => getLeaderboardWelfareScore(s);

    const getHungerRank = (s, mode) => {
      const ph = getPetHungerPhase(s, hungerCfg);
      if (mode === 'hungerDeadFirst') {
        if (ph === 'dead') return 0;
        if (ph === 'critical') return 1;
        if (ph === 'hungry') return 2;
        return 3;
      } else {
        if (ph === 'critical') return 0;
        if (ph === 'dead') return 1;
        if (ph === 'hungry') return 2;
        return 3;
      }
    };

    // 预计算排序值，避免在 sort 循环中重复计算（尤其是 calcLevelInfo 这种重型函数）
    const mapped = list.map(s => {
      let sortVal = 0;
      let nameKey = '';
      if (_sortMode === 'nameInitial' || _sortMode === 'hungerDeadFirst' || _sortMode === 'hungerCriticalFirst') {
        nameKey = String(s.name || '');
      }

      switch (_sortMode) {
        case 'joinOrder': sortVal = new Date(s.createdAt || 0).getTime(); break;
        case 'leaderboard': sortVal = welfare(s); break;
        case 'progress': sortVal = s.petType ? calcLevelInfo(s.fedLegs || 0, levelCfg).progress : -1; break;
        case 'hungerDeadFirst':
        case 'hungerCriticalFirst': sortVal = getHungerRank(s, _sortMode); break;
      }
      return { s, sortVal, nameKey };
    });

    mapped.sort((a, b) => {
      switch (_sortMode) {
        case 'joinOrder': return a.sortVal - b.sortVal;
        case 'nameInitial': return a.nameKey.localeCompare(b.nameKey, 'zh-CN');
        case 'leaderboard':
        case 'progress': return b.sortVal - a.sortVal;
        case 'hungerDeadFirst':
        case 'hungerCriticalFirst': 
          return a.sortVal - b.sortVal || a.nameKey.localeCompare(b.nameKey, 'zh-CN');
        default: return 0;
      }
    });

    return mapped.map(item => item.s);
  }

  function init(classId) {
    currentClassId = classId;
    selectedIds.clear();
    isSelectMode = false;
    _activeGroupFilter = null;
    _sortMode = _loadSortMode(classId);
    filters = { name: '', pet: '', group: '', minScore: '', maxScore: '' };
    // Clear header search
    const searchEl = document.getElementById('ch-search');
    if (searchEl) searchEl.value = '';
    refreshDailyAttendance(classId);
    bindFilters();
    bindGridEvents();
    render();
  }

  /* 每日刷新：非当日的 attendance 归档到历史，再清空 */
  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function weekdayName(dateStr) {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? '' : names[d.getDay()];
  }
  function refreshDailyAttendance(classId) {
    const today = todayStr();
    const list = Store.students.byClass(classId);
    list.forEach(s => {
      if (s.attendance && s.attendanceDate && s.attendanceDate !== today) {
        const history = Array.isArray(s.attendanceHistory) ? s.attendanceHistory.slice() : [];
        history.push({ date: s.attendanceDate, status: s.attendance });
        Store.students.update(s.id, { attendance: '', attendanceDate: '', attendanceHistory: history });
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     事件委托：在 grid 上绑定一次，覆盖所有卡片按钮和菜单项。
     re-render 时 innerHTML 替换，但委托监听器依然有效。
  ───────────────────────────────────────────────────── */
  function bindGridEvents() {
    const grid = document.getElementById('students-grid');
    if (!grid) return;

    // 避免重复绑定
    if (grid._mcBound) return;
    grid._mcBound = true;

    grid.addEventListener('click', e => {
      // 0. 座位编辑模式下屏蔽所有点击操作，仅允许拖拽
      if (_seatEditMode) { e.stopPropagation(); return; }
      // 1. 下拉菜单操作项（优先级最高）
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        e.stopPropagation();
        handleDropdownAction(actionEl.dataset.action, actionEl.dataset.id);
        return;
      }
      // 2. 待领养区域（蛋图 + 点击领养选宠物） / 满级召唤神兽按钮
      const adoptEl = e.target.closest('.ca-adopt');
      if (adoptEl) {
        e.stopPropagation();
        showChangePet(adoptEl.dataset.id);
        return;
      }
      // 3. 加分 / 扣分 / 投喂 / 更多 按钮
      const addBtn = e.target.closest('.ca-add');
      const deductBtn = e.target.closest('.ca-deduct');
      const feedBtn = e.target.closest('.ca-feed');
      const medalWallFab = e.target.closest('.ca-open-medal-wall');
      if (medalWallFab) {
        e.stopPropagation();
        showMedalWall(medalWallFab.dataset.id);
        return;
      }
      const summonBtn = e.target.closest('.ca-summon');
      const readoptBtn = e.target.closest('.ca-readopt');
      if (summonBtn) {
        e.stopPropagation();
        const sid = summonBtn.dataset.id;
        const r = Store.students.summonMaxLevel(sid);
        if (r.ok) {
          const st = Store.students.find(sid);
          UI.toast(`✨ ${(st==null?void 0:st.name) || ''} 已召唤神兽！请点击蛋图领养新萌宠`, 'success', 4200);
          renderCard(sid);
          if (document.getElementById('tab-records').classList.contains('active')) {
            Records.render(currentClassId);
          }
        } else {
          UI.toast(r.msg || '无法召唤', 'warning');
        }
        return;
      }
      if (readoptBtn) {
        e.stopPropagation();
        // 重新领养：先重置该学生当前的宠物养成进度（清空已投喂、等级等），然后弹出选宠框
        const sid = readoptBtn.dataset.id;
        UI.confirm('确定要重新领养吗？当前的宠物进度将清空。', () => {
          Store.students.update(sid, {
            petType: null,
            fedLegs: 0,
            lastPetFedAt: new Date().toISOString()
          });
          showChangePet(sid);
        });
        return;
      }
      const moreBtn = e.target.closest('.ca-more');
      if (addBtn) { e.stopPropagation(); showScoreModal(addBtn.dataset.id, 'add'); return; }
      if (deductBtn) { e.stopPropagation(); showScoreModal(deductBtn.dataset.id, 'deduct'); return; }
      if (feedBtn) { e.stopPropagation(); feedOne(feedBtn.dataset.id); return; }
      if (moreBtn) { e.stopPropagation(); toggleDropdown(moreBtn.dataset.id); return; }
      // 4. 点击勾选框 → 仅编辑模式下选中
      const checkBtn = e.target.closest('.card-select-check');
      if (checkBtn) {
        e.stopPropagation();
        if (isSelectMode) { const card = checkBtn.closest('.student-card'); toggleSelect(checkBtn.dataset.select, card); }
        return;
      }
      // 5. 点击卡片主体（非操作区）→ 编辑模式下多选，否则弹出加减分选择
      const card = e.target.closest('.student-card');
      if (card && !e.target.closest('.card-actions') && !e.target.closest('.card-dropdown') && !e.target.closest('.ca-open-medal-wall') && !e.target.closest('.ca-summon') && !e.target.closest('.ca-readopt')) {
        // 如果宠物已饿死，禁止任何加减分操作
        if (card.classList.contains('is-dead')) {
          return;
        }
        if (isSelectMode) toggleSelect(card.dataset.id, card);
        else showScoreModal(card.dataset.id, 'add');
      }
    });

    grid.addEventListener('contextmenu', e => {
      const card = e.target.closest('.student-card');
      if (card && isSelectMode) { e.preventDefault(); toggleSelect(card.dataset.id, card); }
    });
  }

  function bindFilters() {
    const fi = id => document.getElementById(id);
    fi('filter-name').value = '';
    fi('filter-pet').value = '';
    fi('filter-group').value = '';
    fi('filter-score-min').value = '';
    fi('filter-score-max').value = '';

    fi('filter-name').oninput = () => { filters.name = fi('filter-name').value.toLowerCase(); render({ skipFilters: true }); };
    fi('filter-pet').onchange = () => { filters.pet = fi('filter-pet').value; render({ skipFilters: true }); };
    fi('filter-group').onchange = () => { filters.group = fi('filter-group').value; render({ skipFilters: true }); };
    fi('filter-score-min').oninput = () => { filters.minScore = fi('filter-score-min').value; render({ skipFilters: true }); };
    fi('filter-score-max').oninput = () => { filters.maxScore = fi('filter-score-max').value; render({ skipFilters: true }); };
    fi('btn-filter-reset').onclick = resetFilters;
    document.getElementById('btn-select-all').onclick = toggleSelectAll;

    // batch buttons
    document.getElementById('batch-add-score').onclick = () => batchScoreModal('add');
    document.getElementById('batch-deduct-score').onclick = () => batchScoreModal('deduct');
    document.getElementById('batch-cancel').onclick = () => exitEditMode();
  }

  function resetFilters() {
    filters = { name: '', pet: '', group: '', minScore: '', maxScore: '' };
    ['filter-name', 'filter-pet', 'filter-group', 'filter-score-min', 'filter-score-max']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    render();
  }

  function getFilteredStudents() {
    let list = Store.students.byClass(currentClassId);
    if (filters.name) list = list.filter(s =>
      s.name.toLowerCase().includes(filters.name) ||
      (s.studentNo || '').toLowerCase().includes(filters.name)
    );
    if (filters.pet) list = list.filter(s => s.petType === filters.pet);
    if (filters.group) list = list.filter(s => s.groupIds && s.groupIds.includes(filters.group));
    const welfarePts = s => getLeaderboardWelfareScore(s);
    if (filters.minScore !== '') list = list.filter(s => welfarePts(s) >= Number(filters.minScore));
    if (filters.maxScore !== '') list = list.filter(s => welfarePts(s) <= Number(filters.maxScore));
    // Group filter pill
    if (_activeGroupFilter === '__none__') list = list.filter(s => !s.groupIds || s.groupIds.length === 0);
    else if (_activeGroupFilter) list = list.filter(s => s.groupIds && s.groupIds.includes(_activeGroupFilter));
    return list;
  }

  /** 徽章墙顶部：合并「召唤神兽」贴纸与满级记录，并去重 */
  function getMedalWallPetEntries(s) {
    if (!s) return [];
    const list = [
      ...(s.petStickers || []).map(e => ({ ...e, _from: 'collect' })),
      ...(s.fullLevelPets || []).map(e => ({ ...e, _from: 'summon' })),
    ];
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 去重：同一宠物的「收集」与「召唤」记录如果时间非常接近（2分钟内），视为同一枚徽章
    const result = [];
    for (const item of list) {
      const isDup = result.some(prev => 
        prev.petType === item.petType && 
        Math.abs(new Date(prev.date) - new Date(item.date)) < 120000
      );
      if (!isDup) result.push(item);
    }
    return result;
  }

  /** 升级时：满级用「养成成功」庆典，其余等级用普通 LEVEL UP */
  function playLevelUpOrMaxCelebration(studentId, studentName, petType, levelCfg, oldLi, newLi) {
    if (!newLi || !oldLi || newLi.level <= oldLi.level) return;
    const maxDef = getMaxLevel(levelCfg);
    const isMax = newLi.level >= maxDef.level;
    const petImg = getPetImg(petType, newLi.stage);
    setTimeout(() => {
      if (typeof Effects === 'undefined') return;
      if (isMax && typeof Effects.maxLevelCelebration === 'function') {
        const pet = getPet(petType);
        const petName = (pet==null?void 0:pet.name) || '';
        const stageForImg = maxDef.stage != null ? maxDef.stage : newLi.stage;
        const imgPath = getPetImg(petType, stageForImg);
        Effects.maxLevelCelebration({
          studentName,
          studentId,
          petType,
          petName,
          petImg,
        });
      } else if (typeof Effects.levelUp === 'function') {
        Effects.levelUp(studentName, petType, newLi.level, newLi.title, petImg);
      }
    }, 300);
  }

  let _renderId = 0;

  function render(opts = {}) {
    const grid = document.getElementById('students-grid');
    if (!grid) return;
    closeDropdown();

    // 如果只是排序/筛选变动，没必要重新生成过滤器下拉列表（除非是初次进入或人数变动）
    const fullList = Store.students.byClass(currentClassId);
    const groups = Store.groups.byClass(currentClassId);
    
    if (!opts.skipFilters) {
      UI.populatePetFilter(fullList);
      UI.populateGroupFilter(groups);
      if (typeof ClassView !== 'undefined' && ClassView.renderGroupFilter) ClassView.renderGroupFilter();
    }

    const levelCfg = Store.levels.get(currentClassId);
    const students = applySortToFiltered(getFilteredStudents());

    if (students.length === 0) {
      const isEmpty = fullList.length === 0;
      grid.innerHTML = isEmpty
        ? `<div class="students-empty students-empty-cta">
            <span class="empty-icon">🐾</span>
            <p class="empty-title">班级还没有学生</p>
            <p class="empty-desc">添加学生后即可为他们分配宠物、记录表现、发放徽章等</p>
            <div class="empty-actions">
              <button type="button" class="btn btn-primary empty-cta-btn" id="empty-add-student">
                <i class="ri ri-add-line"></i> 添加学生
              </button>
              <button type="button" class="btn btn-ghost empty-cta-btn" id="empty-import-excel">
                <i class="ri ri-upload-2-line"></i> 批量导入
              </button>
            </div>
          </div>`
        : `<div class="students-empty">
            <span class="empty-icon">🐾</span>
            <p>没有符合条件的学生</p>
          </div>`;
      if (isEmpty) {
        document.getElementById('empty-add-student').onclick = () => showAddModal();
        document.getElementById('empty-import-excel').onclick = () => showBatchAdd();
      }
      return;
    }

    _renderId++;
    const currentRenderId = _renderId;

    /**
     * 核心优化：原子级同步替换
     * 采用离屏构建 DOM -> 一次性原子替换。
     */
    const renderSync = (list) => {
      const fragment = document.createDocumentFragment();
      const temp = document.createElement('div');
      temp.innerHTML = list.map(s => studentCardHtml(s, levelCfg, groups)).join('');
      while (temp.firstChild) fragment.appendChild(temp.firstChild);
      grid.innerHTML = '';
      grid.appendChild(fragment);
      updateBatchBar();
    };

    // 预建学生→记录索引（每次渲染仅扫描一次全量 records，之后每张卡片 O(1) 查）
    const _classRecs = Store.records.byClass(currentClassId);
    const _recIdx = new Map();
    for (const _r of _classRecs) {
      if (!_recIdx.has(_r.studentId)) _recIdx.set(_r.studentId, []);
      _recIdx.get(_r.studentId).push(_r);
    }
    Store.setStudentRecordsIndex(_recIdx);
    renderSync(students);
    Store.clearStudentRecordsIndex();
    applySeatEditModeToGrid();
    applyGridDensity(getGridDensity());
  }

  /* ─────────────────────────────────────────────────────
     座位编辑模式：切换开关、拖拽交换卡片顺序
     ───────────────────────────────────────────────────── */
  function isSeatEditMode() { return _seatEditMode; }
  function toggleSeatEditMode() {
    _seatEditMode = !_seatEditMode;
    if (_seatEditMode) {
      // 退出编辑模式时可能有未提交的选择状态，进入时先清一次
      if (isSelectMode) toggleEditMode();
    }
    render({ skipFilters: true });
    UI.toast(_seatEditMode ? '已进入座位调整模式：拖动学生卡片交换位置' : '已退出座位调整模式', _seatEditMode ? 'info' : 'success', 2400);
    return _seatEditMode;
  }
  function applySeatEditModeToGrid() {
    const grid = document.getElementById('students-grid');
    if (!grid) return;
    grid.classList.toggle('seat-edit-mode', _seatEditMode);
    // 每次渲染完成后，重新给每张卡片绑定拖拽属性
    grid.querySelectorAll('.student-card').forEach(card => {
      if (_seatEditMode) {
        card.setAttribute('draggable', 'true');
      } else {
        card.removeAttribute('draggable');
      }
    });
    bindSeatDragEvents(grid);
  }
  function bindSeatDragEvents(grid) {
    if (grid._seatBound) return;
    grid._seatBound = true;
    let dragEl = null;
    grid.addEventListener('dragstart', (e) => {
      if (!_seatEditMode) return;
      const card = e.target.closest('.student-card');
      if (!card) return;
      dragEl = card;
      card.classList.add('seat-dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', card.dataset.id || ''); } catch (_) {}
    });
    grid.addEventListener('dragend', () => {
      if (dragEl) dragEl.classList.remove('seat-dragging');
      grid.querySelectorAll('.seat-drop-target').forEach(el => el.classList.remove('seat-drop-target'));
      dragEl = null;
    });
    grid.addEventListener('dragover', (e) => {
      if (!_seatEditMode || !dragEl) return;
      const card = e.target.closest('.student-card');
      if (!card || card === dragEl) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
      grid.querySelectorAll('.seat-drop-target').forEach(el => { if (el !== card) el.classList.remove('seat-drop-target'); });
      card.classList.add('seat-drop-target');
    });
    grid.addEventListener('dragleave', (e) => {
      const card = e.target.closest && e.target.closest('.student-card');
      if (card) card.classList.remove('seat-drop-target');
    });
    grid.addEventListener('drop', (e) => {
      if (!_seatEditMode || !dragEl) return;
      const targetCard = e.target.closest('.student-card');
      if (!targetCard || targetCard === dragEl) return;
      e.preventDefault();
      // 纯互换：把 dragEl 和 targetCard 在 DOM 中原地互换，不影响其他卡片
      const parent = dragEl.parentNode;
      if (parent && targetCard.parentNode === parent) {
        const dragNext = dragEl.nextSibling === targetCard ? dragEl : dragEl.nextSibling;
        parent.insertBefore(dragEl, targetCard);
        parent.insertBefore(targetCard, dragNext);
      }
      targetCard.classList.remove('seat-drop-target');
      // 依据 DOM 顺序更新 Store 中该班学生顺序
      const orderedIds = Array.from(grid.querySelectorAll('.student-card')).map(el => el.dataset.id).filter(Boolean);
      if (currentClassId) Store.students.reorderByClass(currentClassId, orderedIds);
      // 用户已手动调整座位，切换排序为“默认（座位）”以保留调整结果，避免其他排序规则覆盖
      if (_sortMode !== 'default') {
        _sortMode = 'default';
        _saveSortMode(_sortMode);
        try { if (typeof ClassView !== 'undefined' && ClassView.setSortModeFromExternal) ClassView.setSortModeFromExternal('default'); } catch (_) {}
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     调整行数：无极滑块，改变学生卡片最小宽度以改变每行数量
     ───────────────────────────────────────────────────── */
  const DENSITY_KEY = 'students_grid_min_width';
  const DENSITY_MIN = 70;   // 最小卡片宽度（列数最多）
  const DENSITY_MAX = 280;  // 最大卡片宽度（列数最少）
  function getGridDensity() {
    const v = parseInt(localStorage.getItem(DENSITY_KEY), 10);
    if (!isNaN(v) && v >= DENSITY_MIN && v <= DENSITY_MAX) return v;
    return 198;
  }
  const DENSITY_BASE = 198; // 基准宽度：对应 zoom=1，即卡片原始尺寸
  function applyGridDensity(px) {
    const grid = document.getElementById('students-grid');
    if (!grid) return;
    const zoom = px / DENSITY_BASE;
    grid.style.setProperty('--card-min-width', px + 'px');
    grid.style.setProperty('--card-zoom', zoom);
    // 固定列宽为 px，让卡片保持原始比例（用 zoom 等比缩放内部）
    grid.style.gridTemplateColumns = `repeat(auto-fill, ${px}px)`;
    // 左右对齐上方按钮列：两端对齐，卡片均匀分布
    grid.style.justifyContent = 'space-between';
  }
  function setGridDensity(px) {
    px = Math.max(DENSITY_MIN, Math.min(DENSITY_MAX, parseInt(px, 10) || 198));
    localStorage.setItem(DENSITY_KEY, String(px));
    applyGridDensity(px);
  }
  // 初次载入时立即应用
  setTimeout(() => applyGridDensity(getGridDensity()), 0);

  let _densityPopover = null;
  function closeDensityAdjuster() {
    if (_densityPopover && _densityPopover.parentNode) {
      _densityPopover.parentNode.removeChild(_densityPopover);
    }
    _densityPopover = null;
    document.removeEventListener('mousedown', _densityOutsideHandler, true);
    document.removeEventListener('keydown', _densityKeyHandler, true);
  }
  function _densityOutsideHandler(e) {
    if (!_densityPopover) return;
    if (_densityPopover.contains(e.target)) return;
    if (e.target.closest && e.target.closest('#btn-grid-density')) return;
    closeDensityAdjuster();
  }
  function _densityKeyHandler(e) {
    if (e.key === 'Escape') closeDensityAdjuster();
  }
  function openDensityAdjuster(anchorBtn) {
    if (_densityPopover) { closeDensityAdjuster(); return; }
    const cur = getGridDensity();
    // 反向：滑块拉大 -> 卡片变小 -> 列数增多
    const sliderVal = DENSITY_MAX + DENSITY_MIN - cur;
    const pop = document.createElement('div');
    pop.className = 'grid-density-popover';
    pop.innerHTML = `
      <div class="gdp-title">调整每行卡片数量</div>
      <input type="range" class="gdp-range" min="${DENSITY_MIN}" max="${DENSITY_MAX}" value="${sliderVal}" step="1">
      <div class="gdp-hint"><span>更少</span><span>更多</span></div>
    `;
    document.body.appendChild(pop);
    _densityPopover = pop;
    // 定位：按钮下方，右对齐
    const rect = anchorBtn.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.top = (rect.bottom + 8) + 'px';
    let left = rect.left;
    // 防止溢出右侧
    const popW = pop.offsetWidth || 240;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (left < 8) left = 8;
    pop.style.left = left + 'px';

    const range = pop.querySelector('.gdp-range');
    range.addEventListener('input', () => {
      const v = parseInt(range.value, 10);
      // 反向映射
      const px = DENSITY_MAX + DENSITY_MIN - v;
      setGridDensity(px);
    });
    // 延迟绑定，避免当前 click 立即触发外部关闭
    setTimeout(() => {
      document.addEventListener('mousedown', _densityOutsideHandler, true);
      document.addEventListener('keydown', _densityKeyHandler, true);
    }, 0);
  }

  function renderCard(id) {
    const cardEl = document.querySelector(`.student-card[data-id="${id}"]`);
    if (!cardEl) return;
    const s = Store.students.find(id);
    if (!s) return;
    const levelCfg = Store.levels.get(currentClassId);
    const groups = Store.groups.byClass(currentClassId);
    
    // We need to preserve the "selected" state if in select mode
    const isSelected = selectedIds.has(id);
    const newHtml = studentCardHtml(s, levelCfg, groups);
    
    // Replace the card element. outerHTML works because we use event delegation.
    cardEl.outerHTML = newHtml;
    
    // After replacing outerHTML, if it was selected, we need to re-apply the class 
    // because studentCardHtml doesn't know about selectedIds.
    // Wait, studentCardHtml actually handles selection state? Let's check.
    // Looking at line 463 of students.js: const sel = isSelectMode && selectedIds.has(s.id) ? 'selected' : '';
    // Yes, it handles it!
  }

  function studentCardHtml(s, levelCfg, groups) {
    const fedLegs = s.fedLegs || 0;
    const hasPet = !!s.petType;
    const li = hasPet ? calcLevelInfo(fedLegs, levelCfg) : { level: 0, title: '待领养', stage: 1, progress: 0, remaining: 0, nextFeeds: null };

    // Fetch all groups for this student
    const sGroupIds = Array.isArray(s.groupIds) ? s.groupIds : (s.groupId ? [s.groupId] : []);
    const sGroups = sGroupIds.map(gid => groups.find(g => g.id === gid)).filter(Boolean);
    const primaryGroup = sGroups[0] || null;
    const gc = primaryGroup ? primaryGroup.color : 'var(--primary)';

    const sel = selectedIds.has(s.id) ? 'selected' : '';
    const welfarePts = getLeaderboardWelfareScore(s);
    const isNegBadge = (s.totalScore || 0) < 0 || welfarePts < 0;
    const petSrc = hasPet
      ? (isNegBadge && typeof PO_IMG !== 'undefined' ? PO_IMG : getPetImg(s.petType, li.stage))
      : '';
    const pet = hasPet ? getPet(s.petType) : { name: '待领养', emoji: '🥚' };
    const eggSrc = typeof ADOPT_EGG_IMG !== 'undefined' ? ADOPT_EGG_IMG : '';
    const maxDef = getMaxLevel(levelCfg);
    const isMaxLevel = hasPet && li.level >= maxDef.level;

    const progressLabel = hasPet
      ? (li.nextFeeds !== null
        ? `还差 <b class="sc2-remain">${li.remaining}</b> 🍗`
        : `<span class="sc2-maxlv">满级 🎉</span>`)
      : '<span style="color:var(--text-muted);font-weight:600">待领养</span>';

    let groupsHtml = '';
    if (sGroups.length === 0) {
      groupsHtml = `<span class="sc2-grouptag sc2-grouptag-bottom" style="background:rgba(0,0,0,.04);color:var(--text-light);border-color:rgba(0,0,0,.08)">未分组</span>`;
    } else if (sGroups.length === 1) {
      const g = sGroups[0];
      const style = `background:${g.color}18;color:${g.color};border-color:${g.color}40`;
      groupsHtml = `<span class="sc2-grouptag sc2-grouptag-bottom" style="${style}">${g.name}</span>`;
    } else {
      // 多个小组：折叠显示，点击展开
      const allTags = sGroups.map(g => {
        const style = `background:${g.color}18;color:${g.color};border-color:${g.color}40`;
        return `<span class="sc2-grouptag sc2-grouptag-bottom sc2-grouptag-expanded" style="${style}">${g.name}</span>`;
      }).join('');
      const firstColor = sGroups[0].color;
      groupsHtml = `<span class="sc2-grouptags-collapse" data-sid="${s.id}" style="background:${firstColor}18;color:${firstColor};border-color:${firstColor}40" onclick="event.stopPropagation();this.parentNode.classList.toggle('sc2-grouptags-open')">${sGroups.length}个小组 ▾</span><span class="sc2-grouptags-list">${allTags}</span>`;
    }

    const petWallEntries = getMedalWallPetEntries(s);
    const hasWallEntries = petWallEntries.length > 0;
    /** 满级或已有贴纸记录 → 仅显示徽章墙样式角标；仅无宠且无贴纸历史 → 简单 🏅 角标（互斥） */
    const showWallStyleFab = hasWallEntries || (hasPet && isMaxLevel);
    const showBadgeIconFab = !hasPet && !hasWallEntries;

    let cornerFab = '';
    if (showWallStyleFab) {
      const first = hasWallEntries ? petWallEntries[0] : null;
      const ringImg = first
        ? (first.imgPath || '')
        : (hasPet ? getPetImg(s.petType, maxDef.stage) : '');
      const ringEmoji = first
        ? ((getPet(first.petType)||{}). emoji || '🐾')
        : (hasPet ? ((getPet(s.petType)||{}). emoji || '🏅') : '🏅');
      const wallTitle = hasWallEntries
        ? `满级萌宠贴纸 ${petWallEntries.length} 枚`
        : '徽章墙（满级萌宠）';
      const countHtml = hasWallEntries
        ? `<span class="sc2-sticker-fab-count">${petWallEntries.length}</span>`
        : '';
      cornerFab = `<button type="button" class="ca-open-medal-wall sc2-sticker-fab" data-id="${s.id}"
          title="${wallTitle}" aria-label="打开徽章墙">
          <span class="sc2-sticker-fab-ring" aria-hidden="true">
            <img src="${ringImg}" alt="" class="sc2-sticker-fab-thumb"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="sc2-sticker-fab-emoji" style="display:none">${ringEmoji}</span>
          </span>
          ${countHtml}
        </button>`;
    } else if (showBadgeIconFab) {
      cornerFab = `<button type="button" class="ca-open-medal-wall sc2-badge-corner-fab" data-id="${s.id}"
          title="徽章墙" aria-label="打开徽章墙">🏅</button>`;
    }

    let petBlock;
    if (!hasPet) {
      petBlock = `<div class="sc2-adopt-wrap ca-adopt" data-id="${s.id}" title="点击选择要领养的萌宠" role="button" tabindex="0">
          <img src="${eggSrc}" alt="" class="sc2-adopt-egg"
            onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=\\'sc2-adopt-fallback\\'>🥚</div>')">
          <div class="sc2-adopt-text">点击领养选宠物哦</div>
        </div>`;
    } else if (isMaxLevel) {
      petBlock = `<div class="sc2-pet-max">
          <img src="${petSrc}" alt="${pet.name}" class="sc2-pet-img card-pet-img${isNegBadge ? ' sc2-pet-img--po' : ''}"
            title="${isNegBadge ? '福利或徽章为负，显示破蛋形象' : pet.name}"
            onerror="this.outerHTML='<div class=sc2-pet-miss title=&quot;${pet.name}&quot;>${pet.emoji}</div>'">
          <button type="button" class="sc2-summon-btn ca-summon" data-id="${s.id}"
            title="召唤神兽后将进入领养，可重新选择萌宠">召唤神兽</button>
        </div>`;
    } else {
      petBlock = `<img src="${petSrc}" alt="${pet.name}" class="sc2-pet-img card-pet-img${isNegBadge ? ' sc2-pet-img--po' : ''}"
          title="${isNegBadge ? '福利或徽章为负，显示破蛋形象' : pet.name}"
          onerror="this.outerHTML='<div class=sc2-pet-miss title=&quot;${pet.name}&quot;>${pet.emoji}</div>'">`;
    }

    const hungerCfg = Store.hunger.get(currentClassId);
    const hungerPhase = getPetHungerPhase(s, hungerCfg); // null | 'hungry' | 'critical' | 'dead'

    let hungerOverlay = '';
    let hungerClass = '';
    if (hungerPhase === 'hungry') {
      hungerClass = ' is-hungry'; // 不加灰色类
      hungerOverlay = `<div class="sc2-hunger-overlay"><div class="sc2-hunger-msg">🍖 好饿</div></div>`;
    } else if (hungerPhase === 'critical') {
      hungerClass = ' is-critical'; // 不加灰色类
      hungerOverlay = `<div class="sc2-hunger-overlay"><div class="sc2-hunger-msg">⚠️ 濒死</div></div>`;
    } else if (hungerPhase === 'dead') {
      hungerClass = ' sc2--hunger-gray is-dead'; // 仅饿死加灰色
      hungerOverlay = `
        <div class="sc2-hunger-overlay">
          <div class="sc2-hunger-content">
            <div class="sc2-hunger-msg">💀 已饿死</div>
            <button type="button" class="sc2-readopt-btn ca-readopt" data-id="${s.id}">重新领养</button>
          </div>
        </div>`;
    }

    return `
    <div class="sc2 student-card ${sel}${hungerClass}" data-id="${s.id}" style="--gc:${gc}">
      ${hungerOverlay}
      <div class="card-select-check sc2-check" data-select="${s.id}" title="点击选择">
        <span class="card-check-icon sc2-check-icon">${selectedIds.has(s.id) ? '✓' : ''}</span>
      </div>
      <div class="sc2-top">
        <span class="sc2-lv">${hasPet ? `Lv.${li.level}` : '—'}</span>
        <button class="sc2-btn sc2-btn-more ca-more" data-id="${s.id}" title="更多">···</button>
      </div>
      <div class="sc2-pet"${s.petBg ? ` style="background-image:url('${s.petBg}');background-size:cover;background-position:center;background-repeat:no-repeat;"` : ''}>
        ${petBlock}
      </div>
      <div class="sc2-name-row">
        <span class="sc2-name" title="${s.name}">${s.name}</span>
        ${s.attendance === 'leave' ? `<span class="sc2-att sc2-att--leave" title="出勤状态">请假</span>` : ''}
        ${s.attendance === 'absent' ? `<span class="sc2-att sc2-att--absent" title="出勤状态">缺课</span>` : ''}
        ${hasPet ? `<span class="sc2-pet-name" style="font-size:0.75rem;color:var(--primary);margin-left:0.5rem;" title="${s.petName ? '宠物名字' : '宠物种类'}">${s.petName || getPet(s.petType).name}</span>` : ''}
        ${s.studentNo ? `<span class="sc2-no">${s.studentNo}</span>` : ''}
      </div>
      <div class="sc2-prog-wrap">
        <div class="sc2-prog-labels">
          <span class="sc2-prog-title">本级进度</span>
          <span class="sc2-prog-right">${progressLabel}</span>
        </div>
        <div class="sc2-prog-bar">
          <div class="sc2-prog-fill" style="width:${hasPet ? li.progress : 0}%"></div>
        </div>
      </div>
      <div class="sc2-stats card-actions">
        <span class="sc2-stat-item" title="福利总积分：可为负（扣分超过累计时）；历史投喂 + 鸡腿 − 兑换">🏆 <b>${welfarePts}</b></span>
        <div class="sc2-grouptags-row">${groupsHtml}</div>
      </div>
      ${cornerFab}
    </div>`;
  }

  function dropdownMenuHtml(id) {
    const s = Store.students.find(id);
    const redeemCount = Store.records.byStudent(id).filter(r => r.type === 'redeem').length;
    const levelCfg = Store.levels.get(currentClassId);
    const li = s && s.petType ? calcLevelInfo(s.fedLegs || 0, levelCfg) : { level: 0 };
    const bgUnlocked = li.level >= 5;
    return `
    <div class="card-action-menu">
      <button class="cam-item" data-action="edit" data-id="${id}">
        <span class="cam-icon">✏️</span>
        <div class="cam-text"><div class="cam-label">编辑资料</div><div class="cam-sub">修改姓名、宠物与分组</div></div>
      </button>
      <button class="cam-item" data-action="editPetName" data-id="${id}">
        <span class="cam-icon">🏷️</span>
        <div class="cam-text"><div class="cam-label">修改宠物名</div><div class="cam-sub">给宠物起个名字</div></div>
      </button>
      <button class="cam-item" data-action="changePet" data-id="${id}">
        <span class="cam-icon">🔄</span>
        <div class="cam-text"><div class="cam-label">更换宠物</div><div class="cam-sub">更换学生的萌宠形象</div></div>
      </button>
      <button class="cam-item${bgUnlocked ? '' : ' cam-item--disabled'}" data-action="changePetBg" data-id="${id}">
        <span class="cam-icon">🖼️</span>
        <div class="cam-text">
          <div class="cam-label">切换宠物背景</div>
          <div class="cam-sub">${bgUnlocked ? '选择宠物区域背景图' : '满5级后可解锁'}</div>
        </div>
      </button>
      <button class="cam-item" data-action="redeemForStudent" data-id="${id}">
        <span class="cam-icon">�️</span>
        <div class="cam-text">
          <div class="cam-label">小卖部兑换商品</div>
          <div class="cam-sub">直接为学生进行商品兑换</div>
        </div>
      </button>
      <button class="cam-item" data-action="medalWall" data-id="${id}">
        <span class="cam-icon">🏅</span>
        <div class="cam-text">
          <div class="cam-label">徽章墙与奖状</div>
          <div class="cam-sub">满级贴纸、荣誉奖状与导出</div>
        </div>
      </button>
      <button class="cam-item${li.level >= 10 ? '' : ' cam-item--disabled'}" data-action="honorBadge" data-id="${id}">
        <span class="cam-icon">🎖️</span>
        <div class="cam-text">
          <div class="cam-label">荣誉徽章</div>
          <div class="cam-sub">${li.level >= 10 ? '下载荣誉徽章PNG图' : '满10级后可解锁'}</div>
        </div>
      </button>
      <button class="cam-item" data-action="attendance" data-id="${id}">
        <span class="cam-icon">📋</span>
        <div class="cam-text">
          <div class="cam-label">出勤记录</div>
          <div class="cam-sub">${s && s.attendance === 'leave' ? '当前：请假' : s && s.attendance === 'absent' ? '当前：缺课' : '标记请假或缺课'}</div>
        </div>
      </button>
      <div class="cam-divider"></div>
      <button class="cam-item cam-item--danger" data-action="delete" data-id="${id}">
        <span class="cam-icon">🗑️</span>
        <div class="cam-text"><div class="cam-label">删除学生</div><div class="cam-sub">此操作不可撤销</div></div>
      </button>
    </div>`;
  }

  function toggleDropdown(id) {
    const s = Store.students.find(id);
    if (!s) return;
    UI.openModal(`⚙️ ${s.name}`, dropdownMenuHtml(id), { narrow: true });
    // 绑定菜单项点击（modal-body 内，不经过 grid 委托）
    document.querySelectorAll('#modal-body [data-action]').forEach(btn => {
      if (!btn.classList.contains('cam-item--disabled')) {
        btn.onclick = () => handleDropdownAction(btn.dataset.action, btn.dataset.id);
      }
    });
  }

  function closeDropdown() {
    openDropdownId = null;
  }

  function handleDropdownAction(action, id) {
    const s = Store.students.find(id);
    if (!s) return;
    switch (action) {
      case 'edit': showEditModal(id); break;
      case 'editPetName': showEditPetNameModal(id); break;
      case 'changePet': showChangePet(id); break;
      case 'changePetBg': showChangePetBg(id); break;
      case 'redeemForStudent': showRedeemForStudent(id); break;
      case 'medalWall': showMedalWall(id); break;
      case 'honorBadge': showHonorBadge(id); break;
      case 'attendance': showAttendanceModal(id); break;
      case 'delete': deleteStudent(id); break;
    }
  }

  /* ── 荣誉徽章 ── */
  function showHonorBadge(id) {
    const s = Store.students.find(id);
    if (!s) return;
    
    UI.closeModal();
    
    const levelCfg = Store.levels.get(currentClassId) || DEFAULT_LEVELS;
    const li = s && s.petType ? calcLevelInfo(s.fedLegs || 0, levelCfg) : { level: 0 };
    
    const canDownload = li.level >= 10;

    const html = `
      <div style="padding:1rem 0;text-align:center">
        ${!canDownload ? `<div style="background:#FFF3CD;color:#856404;padding:.75rem 1rem;border-radius:var(--radius-md);margin-bottom:1rem;font-size:.9rem">
          ⚠️ 该学生当前等级为 <b>Lv.${li.level}</b>，需满10级方可下载徽章图片
        </div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;max-width:100%;margin:0 auto;padding:0 2rem">
          <div id="honor-badge-preview-1" style="position:relative">
            <canvas id="honor-badge-canvas-1" width="800" height="800" style="width:100%;height:auto;border:3px solid var(--border);border-radius:var(--radius-lg)"></canvas>
            <div style="text-align:center;margin-top:0.5rem">
              ${canDownload 
                ? '<button class="btn-primary" style="font-size:0.85rem;padding:0.4rem 0.8rem" onclick="window.downloadBadgeImage(\'' + s.name + '\', \'honor-badge-canvas-1\', \'节约粮食之星\')">📥 下载</button>' 
                : '<button class="btn-primary" disabled style="opacity:.5;cursor:not-allowed;font-size:0.85rem;padding:0.4rem 0.8rem">🔒 满10级后可下载</button>'}
            </div>
          </div>
          <div id="honor-badge-preview-2" style="position:relative">
            <canvas id="honor-badge-canvas-2" width="800" height="800" style="width:100%;height:auto;border:3px solid var(--border);border-radius:var(--radius-lg)"></canvas>
            <div style="text-align:center;margin-top:0.5rem">
              ${canDownload 
                ? '<button class="btn-primary" style="font-size:0.85rem;padding:0.4rem 0.8rem" onclick="window.downloadBadgeImage(\'' + s.name + '\', \'honor-badge-canvas-2\', \'节约水资源之星\')">📥 下载</button>' 
                : '<button class="btn-primary" disabled style="opacity:.5;cursor:not-allowed;font-size:0.85rem;padding:0.4rem 0.8rem">🔒 满10级后可下载</button>'}
            </div>
          </div>
          <div id="honor-badge-preview-3" style="position:relative">
            <canvas id="honor-badge-canvas-3" width="800" height="800" style="width:100%;height:auto;border:3px solid var(--border);border-radius:var(--radius-lg)"></canvas>
            <div style="text-align:center;margin-top:0.5rem">
              ${canDownload 
                ? '<button class="btn-primary" style="font-size:0.85rem;padding:0.4rem 0.8rem" onclick="window.downloadBadgeImage(\'' + s.name + '\', \'honor-badge-canvas-3\', \'节约用电之星\')">📥 下载</button>' 
                : '<button class="btn-primary" disabled style="opacity:.5;cursor:not-allowed;font-size:0.85rem;padding:0.4rem 0.8rem">🔒 满10级后可下载</button>'}
            </div>
          </div>
        </div>
        <div style="margin-top:1.5rem;display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
          <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
        </div>
      </div>`;
    
    UI.openModal(`🎖️ 荣誉徽章 — ${s.name}`, html, { wide: true });
    
    setTimeout(() => {
      renderHonorBadge(s.name, 'honor-badge-canvas-1', '节约粮食', 'blue');
      renderHonorBadge(s.name, 'honor-badge-canvas-2', '节约水资源', 'yellow');
      renderHonorBadge(s.name, 'honor-badge-canvas-3', '节约用电', 'purple');
    }, 100);
  }

  function renderHonorBadge(studentName, canvasId = 'honor-badge-canvas', titleText = '节约粮食', theme = 'blue') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // 定义颜色主题
    const themes = {
      blue: {
        bg1: '#E3F2FD', bg2: '#BBDEFB', bg3: '#90CAF9',
        ring1: '#BBDEFB', ring2: '#90CAF9', ring3: '#64B5F6',
        ribbon1: '#BBDEFB', ribbon2: '#90CAF9',
        text: '#1565C0', textStroke: '#1976D2',
        ribbonText: '#1976D2',
        star1: '#90CAF9', star2: '#64B5F6', star3: '#42A5F5'
      },
      yellow: {
        bg1: '#FFF9E6', bg2: '#FFF3CD', bg3: '#FFE599',
        ring1: '#FFE599', ring2: '#FFD966', ring3: '#FFCC00',
        ribbon1: '#FFE599', ribbon2: '#FFD966',
        text: '#CC8800', textStroke: '#DD9900',
        ribbonText: '#CC8800',
        star1: '#FFD966', star2: '#FFCC00', star3: '#FFC107'
      },
      purple: {
        bg1: '#F3E5F5', bg2: '#E1BEE7', bg3: '#CE93D8',
        ring1: '#E1BEE7', ring2: '#CE93D8', ring3: '#BA68C8',
        ribbon1: '#E1BEE7', ribbon2: '#CE93D8',
        text: '#7B1FA2', textStroke: '#8E24AA',
        ribbonText: '#7B1FA2',
        star1: '#CE93D8', star2: '#BA68C8', star3: '#AB47BC'
      }
    };
    
    const colors = themes[theme] || themes.blue;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      ctx.drawImage(img, 0, 0, w, h);
    };
    
    img.onerror = function() {
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(0, 0, w, h);
      
      ctx.fillStyle = '#8B4513';
      ctx.font = 'bold 80px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('劳动光荣', w / 2, h * 0.35);
      
      ctx.font = 'bold 72px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText('劳动小能手', w / 2, h * 0.48);
      
      ctx.fillStyle = '#8B0000';
      ctx.font = 'bold 68px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(studentName, w / 2, h * 0.82);
      
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 8;
      ctx.strokeRect(40, 40, w - 80, h - 80);
    };
    
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <defs>
          <!-- 浅色背景圆渐变 -->
          <radialGradient id="circleBg-${canvasId}" cx="50%" cy="50%">
            <stop offset="0%" style="stop-color:${colors.bg1};stop-opacity:1" />
            <stop offset="60%" style="stop-color:${colors.bg2};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.bg3};stop-opacity:0.8" />
          </radialGradient>
          
          <!-- 外圈渐变 -->
          <linearGradient id="ringGrad-${canvasId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${colors.ring1};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${colors.ring2};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.ring3};stop-opacity:1" />
          </linearGradient>
          
          <!-- 飘带渐变 -->
          <linearGradient id="ribbonGrad-${canvasId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${colors.ribbon1};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.ribbon2};stop-opacity:1" />
          </linearGradient>
          
          <!-- 条纹背景 -->
          <pattern id="stripePattern-${canvasId}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="10" height="20" fill="${colors.bg1}"/>
            <rect x="10" y="0" width="10" height="20" fill="#FFFFFF"/>
          </pattern>
          
          <!-- 金色五角星渐变 -->
          <radialGradient id="goldStarGrad-${canvasId}" cx="30%" cy="30%">
            <stop offset="0%" style="stop-color:#FFF9C4;stop-opacity:1" />
            <stop offset="40%" style="stop-color:#FFD54F;stop-opacity:1" />
            <stop offset="70%" style="stop-color:#FFC107;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FF8F00;stop-opacity:1" />
          </radialGradient>
          
          <!-- 柔和阴影滤镜 -->
          <filter id="softShadow-${canvasId}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
            <feOffset dx="0" dy="3" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.25"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- 主圆形徽章 -->
        <g transform="translate(400,320)">
          <!-- 外层大圆背景 -->
          <circle cx="0" cy="0" r="200" fill="url(#circleBg-${canvasId})" opacity="0.6"/>
          
          <!-- 装饰星星（外圈） -->
          ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => {
            const rad = angle * Math.PI / 180;
            const distance = 190;
            const x = Math.cos(rad - Math.PI/2) * distance;
            const y = Math.sin(rad - Math.PI/2) * distance;
            const size = (angle % 60 === 0) ? 12 : 8;
            const isFourPoint = angle % 90 === 0;
            
            if (isFourPoint) {
              return `
                <g transform="translate(${x},${y}) rotate(45)">
                  <path d="M 0,-${size} L ${size*0.3},-${size*0.3} L ${size},0 L ${size*0.3},${size*0.3} L 0,${size} L -${size*0.3},${size*0.3} L -${size},0 L -${size*0.3},-${size*0.3} Z" 
                        fill="${colors.star1}" opacity="0.8"/>
                </g>`;
            } else {
              return `
                <g transform="translate(${x},${y})">
                  <path d="M 0,-${size} L ${size*0.25},-${size*0.3} L ${size*0.4},0 L ${size*0.25},${size*0.3} L 0,${size} L -${size*0.25},${size*0.3} L -${size*0.4},0 L -${size*0.25},-${size*0.3} Z" 
                        fill="${colors.star2}" opacity="0.6"/>
                </g>`;
            }
          }).join('')}
          
          <!-- 圆环 -->
          <circle cx="0" cy="0" r="170" fill="none" stroke="url(#ringGrad-${canvasId})" stroke-width="12" opacity="0.9" filter="url(#softShadow-${canvasId})"/>
          <circle cx="0" cy="0" r="170" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="0.5"/>
          
          <!-- 内圈纯色背景圆 -->
          <circle cx="0" cy="0" r="158" fill="#FFFFFF" stroke="${colors.ring2}" stroke-width="2"/>
          
          <!-- 装饰性光芒线条 -->
          ${[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
            const rad = angle * Math.PI / 180;
            const x1 = Math.cos(rad - Math.PI/2) * 80;
            const y1 = Math.sin(rad - Math.PI/2) * 80;
            const x2 = Math.cos(rad - Math.PI/2) * 140;
            const y2 = Math.sin(rad - Math.PI/2) * 140;
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.ring1}" stroke-width="2" opacity="0.5"/>`;
          }).join('')}
          
          <!-- 底部圆弧边缘的五角星装饰 -->
          ${[180, 200, 220, 240, 260, 280, 300, 320, 340, 0, 20, 40, 60, 80, 100, 120, 140, 160].map(angle => {
            const rad = angle * Math.PI / 180;
            const distance = 135;
            const x = Math.cos(rad - Math.PI/2) * distance;
            const y = Math.sin(rad - Math.PI/2) * distance;
            const size = (angle % 40 === 0) ? 8 : 6;
            const rotation = angle;
            
            return `
              <g transform="translate(${x},${y}) rotate(${rotation})">
                <path d="M 0,-${size} L ${size*0.3},-${size*0.3} L ${size*0.95},0 L ${size*0.3},${size*0.3} L 0,${size} L -${size*0.3},${size*0.3} L -${size*0.95},0 L -${size*0.3},-${size*0.3} Z" 
                      fill="${colors.star3}" stroke="${colors.star2}" stroke-width="0.5" opacity="0.9" filter="url(#softShadow-${canvasId})"/>
              </g>`;
          }).join('')}
          
          <!-- 顶部圆弧边缘的五角星装饰（较小） -->
          ${[200, 220, 240, 260, 280, 300, 320, 340].map(angle => {
            const rad = angle * Math.PI / 180;
            const distance = 135;
            const x = Math.cos(rad - Math.PI/2) * distance;
            const y = Math.sin(rad - Math.PI/2) * distance;
            const size = 5;
            const rotation = angle;
            
            return `
              <g transform="translate(${x},${y}) rotate(${rotation})">
                <path d="M 0,-${size} L ${size*0.3},-${size*0.3} L ${size*0.95},0 L ${size*0.3},${size*0.3} L 0,${size} L -${size*0.3},${size*0.3} L -${size*0.95},0 L -${size*0.3},-${size*0.3} Z" 
                      fill="${colors.star3}" opacity="0.7"/>
              </g>`;
          }).join('')}
          
          <!-- 内圈装饰小星星 -->
          ${[-60, -20, 20, 60].map(x => `
            <g transform="translate(${x},-80)">
              <path d="M 0,-4 L 1,-1 L 4,0 L 1,1 L 0,4 L -1,1 L -4,0 L -1,-1 Z" 
                    fill="${colors.star2}" opacity="0.7"/>
            </g>
          `).join('')}
          ${[-60, -20, 20, 60].map(x => `
            <g transform="translate(${x},80)">
              <path d="M 0,-4 L 1,-1 L 4,0 L 1,1 L 0,4 L -1,1 L -4,0 L -1,-1 Z" 
                    fill="${colors.star2}" opacity="0.7"/>
            </g>
          `).join('')}
          
          <!-- 圆圈内的文字 - 描边层 -->
          <text x="0" y="-15" font-family="Microsoft YaHei, SimHei, sans-serif" font-size="50" 
                font-weight="bold" fill="none" stroke="${colors.textStroke}" stroke-width="4" 
                text-anchor="middle" letter-spacing="5">${titleText}</text>
          <text x="0" y="40" font-family="Microsoft YaHei, SimHei, sans-serif" font-size="50" 
                font-weight="bold" fill="none" stroke="${colors.textStroke}" stroke-width="4" 
                text-anchor="middle" letter-spacing="8">之星</text>
          
          <!-- 圆圈内的文字 - 主体层 -->
          <text x="0" y="-15" font-family="Microsoft YaHei, SimHei, sans-serif" font-size="50" 
                font-weight="bold" fill="${colors.text}" text-anchor="middle" letter-spacing="5">${titleText}</text>
          <text x="0" y="40" font-family="Microsoft YaHei, SimHei, sans-serif" font-size="50" 
                font-weight="bold" fill="${colors.text}" text-anchor="middle" letter-spacing="8">之星</text>
          
          <!-- 大五角星装饰（字体下方） -->
          <g transform="translate(0,105)">
            <!-- 五角星阴影 -->
            <path d="M 0,-30 L 9,-9 L 31,-9 L 13,5 L 21,27 L 0,13 L -21,27 L -13,5 L -31,-9 L -9,-9 Z" 
                  fill="#000000" opacity="0.15" transform="translate(2,2)"/>
            <!-- 五角星主体 - 金色渐变 -->
            <path d="M 0,-30 L 9,-9 L 31,-9 L 13,5 L 21,27 L 0,13 L -21,27 L -13,5 L -31,-9 L -9,-9 Z" 
                  fill="url(#goldStarGrad)" stroke="#F57C00" stroke-width="2"/>
            <!-- 五角星高光 -->
            <circle cx="-5" cy="-10" r="8" fill="#FFFFFF" opacity="0.6"/>
          </g>
        </g>
        
        <!-- 底部飘带 -->
        <g transform="translate(400,530)" filter="url(#softShadow-${canvasId})">
          <!-- 左侧飘带 -->
          <path d="M -150,-15 L -130,-15 L -170,60 L -190,60 Z" 
                fill="url(#ribbonGrad-${canvasId})" stroke="${colors.ring3}" stroke-width="2"/>
          <path d="M -150,-15 L -130,-15 L -130,0 L -150,0 Z" 
                fill="${colors.ribbon1}"/>
          <!-- 左侧飘带尖角 -->
          <path d="M -170,60 L -190,60 L -180,75 Z" fill="${colors.ring3}"/>
          
          <!-- 中间飘带主体 -->
          <path d="M -130,-25 L 130,-25 L 130,25 L -130,25 Z" 
                fill="url(#ribbonGrad-${canvasId})" stroke="${colors.ring3}" stroke-width="2"/>
          <!-- 飘带上缘高光 -->
          <rect x="-125" y="-20" width="250" height="8" rx="4" fill="${colors.bg1}" opacity="0.8"/>
          
          <!-- 右侧飘带 -->
          <path d="M 150,-15 L 130,-15 L 170,60 L 190,60 Z" 
                fill="url(#ribbonGrad-${canvasId})" stroke="${colors.ring3}" stroke-width="2"/>
          <path d="M 150,-15 L 130,-15 L 130,0 L 150,0 Z" 
                fill="${colors.ribbon1}"/>
          <!-- 右侧飘带尖角 -->
          <path d="M 170,60 L 190,60 L 180,75 Z" fill="${colors.ring3}"/>
          
          <!-- 飘带内的姓名文字 -->
          <text x="0" y="8" font-family="Microsoft YaHei, SimHei" font-size="32" 
                font-weight="bold" fill="${colors.ribbonText}" text-anchor="middle">${studentName}</text>
        </g>
      </svg>
    `;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  }

  function downloadBadgeImage(studentName, canvasId, badgeTitle) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    try {
      canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${badgeTitle}-${studentName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        UI.toast('徽章图片已下载', 'success');
      }, 'image/png');
    } catch (e) {
      console.error('下载失败:', e);
      UI.toast('下载失败，请重试', 'error');
    }
  }
  
  // 将下载函数暴露到全局，供HTML onclick调用
  window.downloadBadgeImage = downloadBadgeImage;

  /* ── 出勤记录 ── */
  function showAttendanceModal(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const current = s.attendance || '';
    const html = `
      <div style="padding:.5rem 0">
        <p style="margin:0 0 1rem;color:var(--text-muted);font-size:.9rem">为 <b>${s.name}</b> 标记本次出勤状态：</p>
        <label class="att-opt" style="display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;margin-bottom:.5rem">
          <input type="radio" name="attendance" value="" ${current === '' ? 'checked' : ''}>
          <span style="font-weight:600">✅ 正常出勤</span>
        </label>
        <label class="att-opt" style="display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;margin-bottom:.5rem">
          <input type="radio" name="attendance" value="leave" ${current === 'leave' ? 'checked' : ''}>
          <span style="font-weight:600">📝 请假</span>
        </label>
        <label class="att-opt" style="display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer">
          <input type="radio" name="attendance" value="absent" ${current === 'absent' ? 'checked' : ''}>
          <span style="font-weight:600">❌ 缺课</span>
        </label>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-top:1rem">
        <button class="btn-sm btn-ghost" id="att-history-btn" style="color:var(--primary);padding-left:0;font-weight:600">📚 所有出勤记录</button>
        <div style="display:flex;gap:.5rem">
          <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
          <button class="btn-primary" id="att-confirm-btn">确定</button>
        </div>
      </div>`;
    UI.openModal(`📋 出勤记录 — ${s.name}`, html, { narrow: true });
    const btn = document.getElementById('att-confirm-btn');
    if (btn) {
      btn.onclick = () => {
        const checked = document.querySelector('input[name="attendance"]:checked');
        const val = checked ? checked.value : '';
        const today = todayStr();
        const history = Array.isArray(s.attendanceHistory) ? s.attendanceHistory.slice() : [];
        // 若当日已有记录则覆盖，否则追加（仅记录非"正常出勤"，正常出勤不入历史）
        const idx = history.findIndex(h => h.date === today);
        if (val) {
          if (idx >= 0) history[idx] = { date: today, status: val };
          else history.push({ date: today, status: val });
        } else if (idx >= 0) {
          history.splice(idx, 1);
        }
        Store.students.update(id, {
          attendance: val,
          attendanceDate: val ? today : '',
          attendanceHistory: history,
        });
        UI.closeModal();
        const label = val === 'leave' ? '请假' : val === 'absent' ? '缺课' : '正常出勤';
        UI.toast(`已将 ${s.name} 标记为「${label}」`, 'success');
        render();
      };
    }
    const historyBtn = document.getElementById('att-history-btn');
    if (historyBtn) {
      historyBtn.onclick = () => showAttendanceHistory(id);
    }
  }

  /* 展示某学生的所有出勤历史记录 */
  function showAttendanceHistory(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const history = Array.isArray(s.attendanceHistory) ? s.attendanceHistory.slice() : [];
    history.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const rowsHtml = history.length === 0
      ? '<p style="text-align:center;color:var(--text-muted);padding:2rem">暂无出勤记录</p>'
      : history.map(h => {
        const label = h.status === 'leave' ? '请假' : h.status === 'absent' ? '缺课' : '正常出勤';
        const cls = h.status === 'leave' ? 'sc2-att--leave' : h.status === 'absent' ? 'sc2-att--absent' : '';
        const wk = weekdayName(h.date);
        return `<div class="redeem-record-item">
            <span class="rri-reward">📅 ${h.date}${wk ? ' ' + wk : ''}</span>
            <span class="sc2-att ${cls}">${label}</span>
          </div>`;
      }).join('');
    UI.openModal(`📚 ${s.name} 的出勤记录`, `
      <div class="redeem-records-list" style="max-height:360px;overflow-y:auto">
        ${rowsHtml}
      </div>
      <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center">
        <button class="btn-sm btn-ghost" onclick="Students.showAttendanceModal('${id}')" style="color:var(--primary);padding-left:0;font-weight:600">📋 返回标记</button>
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`, { narrow: true });
  }

  /* ── 兑换商品记录 ── */
  function _rriStatusMeta(status) {
    if (status === 'used') return { text: '已使用', color: '#16a34a', bg: 'rgba(22,163,74,.12)', border: 'rgba(22,163,74,.35)' };
    return { text: '未使用', color: '#f59e0b', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.35)' };
  }
  function showRedeemRecords(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const records = Store.records.byStudent(id)
      .filter(r => r.type === 'redeem')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const itemNameRe = /兑换商品：([^（]+)/;
    const listHtml = records.length === 0
      ? '<p style="text-align:center;color:var(--text-muted);padding:2rem">暂无兑换记录</p>'
      : records.map(r => {
        const match = (r.reason || '').match(itemNameRe);
        const reward = match ? match[1].trim() : (r.reason || '兑换');
        const time = r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN') : '-';
        const meta = _rriStatusMeta(r.useStatus);
        const tagHtml = `<button type="button" class="rri-status-tag" data-rid="${r.id}"
            style="margin-left:.5rem;padding:.15rem .55rem;border-radius:999px;border:1px solid ${meta.border};background:${meta.bg};color:${meta.color};font-size:.75rem;font-weight:600;cursor:pointer;line-height:1.4">${meta.text}</button>`;
        return `<div class="redeem-record-item">
            <span class="rri-reward">🎁 ${reward}${tagHtml}</span>
            <span class="rri-time">${time}</span>
          </div>`;
      }).join('');
    UI.openModal(`📋 ${s.name} 的兑换记录`, `
      <div class="redeem-records-list" style="max-height:360px;overflow-y:auto">
        ${listHtml}
      </div>
      <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center">
        <button class="btn-sm btn-ghost" onclick="Students.showRedeemForStudent('${id}')" style="color:var(--primary);padding-left:0;font-weight:600">🛒 返回兑换</button>
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`, { narrow: true });

    // 点击标签弹出选择菜单
    document.querySelectorAll('.rri-status-tag').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const rid = btn.dataset.rid;
        // 移除已有的浮层
        document.querySelectorAll('.rri-status-menu').forEach(el => el.remove());
        const menu = document.createElement('div');
        menu.className = 'rri-status-menu';
        menu.style.cssText = 'position:fixed;z-index:300000;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:.25rem;display:flex;flex-direction:column;min-width:96px';
        [['used','已使用','#16a34a'],['unused','未使用','#f59e0b']].forEach(([val,label,color]) => {
          const opt = document.createElement('button');
          opt.type = 'button';
          opt.textContent = label;
          opt.style.cssText = `text-align:left;padding:.4rem .6rem;border:none;background:transparent;color:${color};font-size:.85rem;font-weight:600;cursor:pointer;border-radius:6px`;
          opt.onmouseenter = () => { opt.style.background = 'rgba(0,0,0,.05)'; };
          opt.onmouseleave = () => { opt.style.background = 'transparent'; };
          opt.onclick = (ev) => {
            ev.stopPropagation();
            Store.records.update(rid, { useStatus: val });
            menu.remove();
            showRedeemRecords(id);
          };
          menu.appendChild(opt);
        });
        document.body.appendChild(menu);
        const rect = btn.getBoundingClientRect();
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.left = rect.left + 'px';
        const closeMenu = (ev) => {
          if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu, true);
          }
        };
        setTimeout(() => document.addEventListener('click', closeMenu, true), 0);
      };
    });
  }

  /* ── 选择项目弹框（加分/扣分） ── */
  function showScoreModal(id, mode) {
    const s = Store.students.find(id);
    if (!s) return;
    const canAddScore = !!s.petType;
    const cfg = Store.scoreItems.get(currentClassId);
    const addItems = cfg.add || SCORE_ADD_ITEMS;
    const deductItems = cfg.deduct || SCORE_DEDUCT_ITEMS;
    const title = `给 ${s.name} 加分/扣分`;
    const searchId = 'score-item-search';
    const addId = 'score-add-grid';
    const deductId = 'score-deduct-grid';

    const addCardsHtml = (list) => list.map(it => `
      <button type="button" class="si-card si-add" data-value="${it.value}" data-reason="${it.name}">
        <i class="si-icon ri ${it.icon}" aria-hidden="true"></i>
        <span class="si-name">${it.name}</span>
        <span class="si-val si-val-add">+${it.value} 🍗</span>
      </button>`).join('');
    const deductCardsHtml = (list) => list.map(it => `
      <button type="button" class="si-card si-deduct" data-value="${it.value}" data-deduct="1" data-reason="${it.name}">
        <i class="si-icon ri ${it.icon}" aria-hidden="true"></i>
        <span class="si-name">${it.name}</span>
        <span class="si-val si-val-deduct">-${it.value} 🍗</span>
      </button>`).join('');

    const body = `
      <label class="si-search-wrap">
        <i class="ri ri-search-line si-search-icon" aria-hidden="true"></i>
        <input type="text" id="${searchId}" class="si-search-input" placeholder="搜索项目 (支持首字母如 cd 搜 迟到)">
      </label>
      <div class="si-section">
        <div class="si-section-title"><i class="ri ri-add-line"></i> 加分项</div>
        <div id="${addId}" class="si-grid">${canAddScore ? addCardsHtml(addItems) : `<div class="si-pet-needed-hint" style="grid-column:1/-1;padding:.85rem .5rem;text-align:center;color:var(--text-muted);font-size:.88rem;line-height:1.55">尚未领养萌宠，无法进行加分或扣分（均与鸡腿关联）。请先点击卡片上的<strong style="color:var(--primary)">点击领养选宠物哦</strong>，或使用菜单中的<strong>更换宠物</strong>。</div>`}</div>
      </div>
      <div class="si-section">
        <div class="si-section-title"><i class="ri ri-subtract-line"></i> 扣分项</div>
        <div id="${deductId}" class="si-grid">${canAddScore ? deductCardsHtml(deductItems) : `<div class="si-pet-needed-hint" style="grid-column:1/-1;padding:.85rem .5rem;text-align:center;color:var(--text-muted);font-size:.88rem;line-height:1.55">尚未领养萌宠，无法进行加分或扣分（均与鸡腿关联）。请先点击卡片上的<strong style="color:var(--primary)">点击领养选宠物哦</strong>，或使用菜单中的<strong>更换宠物</strong>。</div>`}</div>
      </div>
      <p class="si-hint"><i class="ri ri-cursor-line"></i> 点击项目直接操作</p>`;

    UI.openModal(title, body, { wide: true, noAutofocus: true });

    // ── 在弹窗 header 里插入「自定义加分/减分」按钮 ──
    // 先清理上一次遗留的（closeModal 只清 body/footer，不清 header）
    document.querySelectorAll('#modal-box .si-header-actions').forEach(el => el.remove());

    const headerRight = document.querySelector('#modal-box .modal-header');
    const headerActions = document.createElement('div');
    headerActions.className = 'si-header-actions';
    headerActions.innerHTML = `
      <button type="button" class="si-custom-btn si-custom-add" id="si-custom-add-btn" ${canAddScore ? '' : 'disabled title="尚未领养萌宠"'}>
        <i class="ri-add-line"></i> 自定义加分
      </button>
      <button type="button" class="si-custom-btn si-custom-deduct" id="si-custom-deduct-btn" ${canAddScore ? '' : 'disabled title="尚未领养萌宠"'}>
        <i class="ri-subtract-line"></i> 自定义减分
      </button>`;
    headerRight.insertBefore(headerActions, headerRight.querySelector('.modal-close'));

    // 执行加/扣分的核心函数（卡片点击 和 自定义弹窗 共用）
    const doScoreAction = (val, reason) => {
      if (!canAddScore) {
        UI.toast('请先领养萌宠后再进行加分或扣分', 'warning');
        return;
      }
      const cardEl = document.querySelector(`.student-card[data-id="${id}"]`);
      const rawVal = Math.abs(Number(val) || 0);
      const isDeduct = val < 0;
      const signedVal = isDeduct ? -rawVal : rawVal;
      if (rawVal === 0) return;
      window._mc_sync_lock = true;
      const updated = Store.students.addScore(id, signedVal, reason, isDeduct ? 'deduct' : 'add');
      if (!updated) {
        window._mc_sync_lock = false;
        UI.toast('操作失败，请重试', 'error');
        return;
      }
      setTimeout(() => { window._mc_sync_lock = false; }, 2000);
      if (typeof Effects !== 'undefined') {
        if (signedVal > 0 && Effects.playScoreRewardSound) Effects.playScoreRewardSound();
        else if (signedVal < 0 && Effects.playScorePenaltySound) Effects.playScorePenaltySound();
      }
      UI.closeModal();
      Effects.floatScore(cardEl, signedVal);
      Effects.cardScoreFlash(cardEl, signedVal > 0);

      const levelCfg = Store.levels.get(currentClassId);
      const oldLi = calcLevelInfo(s.fedLegs || 0, levelCfg);
      const newLi = calcLevelInfo(updated.fedLegs || 0, levelCfg);
      if (signedVal > 0) {
        Effects.floatFeed(cardEl);
        Effects.cardFeedPulse(cardEl);
        if (newLi.level > oldLi.level) {
          UI.toast(`🎉 ${s.name} +${signedVal} 🍗，升级到 Lv.${newLi.level}！`, 'success', 4000);
          playLevelUpOrMaxCelebration(id, s.name, s.petType, levelCfg, oldLi, newLi);
        } else {
          UI.toast(`${s.name} +${signedVal} 🍗，还差 ${newLi.remaining} 🍗 升级`, 'success');
        }
      } else {
        if (newLi.level < oldLi.level) {
          UI.toast(`⚠️ ${s.name} 因扣分降级到 Lv.${newLi.level} ${newLi.title}`, 'warning', 3500);
        } else {
          UI.toast(`${s.name} ${signedVal} 🍗，还差 ${newLi.remaining} 🍗 升级`, 'warning');
        }
      }
      renderCard(id);
      if (document.getElementById('tab-records').classList.contains('active')) {
        Records.render(currentClassId);
      }
    };

    // 显示内嵌的自定义加/减分小弹窗
    const showCustomSubModal = (type) => {
      const isAdd = type === 'add';
      const label = isAdd ? '自定义加分' : '自定义减分';
      const sign = isAdd ? '+' : '-';
      const defaultReason = isAdd ? '自定义加分' : '自定义减分';
      const initial = isAdd ? 1 : 1;

      const overlay = document.createElement('div');
      overlay.className = 'si-custom-overlay';
      overlay.innerHTML = `
        <div class="si-custom-card si-custom-card-${isAdd ? 'add' : 'deduct'}">
          <div class="si-custom-card-header">
            <span class="si-custom-card-title">${sign} ${label}</span>
            <button type="button" class="si-custom-card-close" title="关闭">✕</button>
          </div>
          <div class="si-custom-card-body">
            <div class="si-custom-field">
              <label>分数</label>
              <input type="number" id="si-custom-val" min="1" max="999" value="${initial}" placeholder="输入分数" inputmode="numeric">
            </div>
            <div class="si-custom-field">
              <label>原因 <span class="si-custom-optional">(选填)</span></label>
              <input type="text" id="si-custom-reason" placeholder="${defaultReason}" value="${defaultReason}">
            </div>
          </div>
          <div class="si-custom-card-footer">
            <button type="button" class="si-custom-confirm ${isAdd ? 'si-custom-confirm-add' : 'si-custom-confirm-deduct'}" id="si-custom-confirm">确定</button>
          </div>
        </div>`;

      document.getElementById('modal-box').appendChild(overlay);

      // 关闭
      const closeSub = () => overlay.remove();
      overlay.querySelector('.si-custom-card-close').onclick = closeSub;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSub(); });

      const valInput = overlay.querySelector('#si-custom-val');
      const reasonInput = overlay.querySelector('#si-custom-reason');
      setTimeout(() => valInput.focus(), 50);

      // 确定
      overlay.querySelector('#si-custom-confirm').onclick = () => {
        const num = Math.abs(parseInt(valInput.value, 10));
        if (!num || num < 1) {
          UI.toast('请输入有效的分数（至少 1）', 'warning');
          valInput.focus();
          return;
        }
        const reason = (reasonInput.value || defaultReason).trim() || defaultReason;
        const signed = isAdd ? num : -num;
        closeSub();
        doScoreAction(signed, reason);
      };

      // Enter 快速确定
      [valInput, reasonInput].forEach(el => {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') overlay.querySelector('#si-custom-confirm').click();
          if (e.key === 'Escape') closeSub();
        });
      });
    };

    // 绑定 header 按钮
    const addBtn = headerActions.querySelector('#si-custom-add-btn');
    const deductBtn = headerActions.querySelector('#si-custom-deduct-btn');
    if (addBtn) addBtn.onclick = () => showCustomSubModal('add');
    if (deductBtn) deductBtn.onclick = () => showCustomSubModal('deduct');

    function filterItems(q) {
      const kw = (q || '').toLowerCase().trim();
      const match = (it) => !kw || it.name.includes(kw) || (it.py && it.py.includes(kw));
      const addList = addItems.filter(match);
      const deductList = deductItems.filter(match);
      if (canAddScore) {
        document.getElementById(addId).innerHTML = addCardsHtml(addList);
        document.getElementById(deductId).innerHTML = deductCardsHtml(deductList);
      }
      bindItemClicks();
    }

    function bindItemClicks() {
      [addId, deductId].forEach(gid => {
        document.getElementById(gid).querySelectorAll('.si-card').forEach(btn => {
          btn.onclick = () => {
            const rawVal = Math.abs(Number(btn.dataset.value) || 0);
            const isDeduct = btn.classList.contains('si-deduct') || !!btn.dataset.deduct;
            const val = isDeduct ? -rawVal : rawVal;
            const reason = (btn.dataset.reason || '选择项目').trim();
            if (rawVal === 0) return;
            doScoreAction(val, reason);
          };
        });
      });
    }

    document.getElementById(searchId).oninput = function () { filterItems(this.value); };
    bindItemClicks();
  }

  function feedOne(id) {
    const s = Store.students.find(id);
    if (!s) return;
    if (!s.petType) {
      UI.toast('请先领养萌宠后再投喂', 'warning');
      return;
    }
    const cardEl = document.querySelector(`.student-card[data-id="${id}"]`);
    // 加锁
    window._mc_sync_lock = true;
    const result = Store.students.feedChickenLeg(id);
    if (!result.ok) {
      window._mc_sync_lock = false;
      UI.toast(`${s.name} ${result.msg}`, 'warning');
      return;
    }
    setTimeout(() => { window._mc_sync_lock = false; }, 2000);
    const levelCfg = Store.levels.get(currentClassId);
    const oldLi = calcLevelInfo(s.fedLegs || 0, levelCfg);
    const newLi = calcLevelInfo(result.updated.fedLegs || 0, levelCfg);
    Effects.floatFeed(cardEl);
    Effects.cardFeedPulse(cardEl);
    if (newLi.level > oldLi.level) {
      UI.toast(`🎉 ${s.name} 的宠物升级到 Lv.${newLi.level}「${newLi.title}」！`, 'success', 4000);
      playLevelUpOrMaxCelebration(id, s.name, s.petType, levelCfg, oldLi, newLi);
    } else {
      UI.toast(`🍗 ${s.name} 投喂成功！还差 ${newLi.remaining} 🍗 升级`, 'success');
    }
    renderCard(id);
    if (document.getElementById('tab-records').classList.contains('active')) {
      Records.render(currentClassId);
    }
  }

  /* ── Feed Multi Modal（齿轮菜单 → 投喂） ── */
  function showFeedModal(id) {
    const s = Store.students.find(id);
    if (!s) return;
    if (!s.petType) {
      UI.toast('请先领养萌宠后再投喂', 'warning');
      return;
    }
    const legs = s.chickenLegs || 0;
    const quickAmounts = [1, 3, 5, 10, 20];
    const quickHtml = quickAmounts.map(n =>
      `<button class="score-quick-btn feed-quick-btn btn-sm btn-ghost" data-val="${n}" ${legs < n ? 'disabled style="opacity:.35"' : ''}>${n} 🍗</button>`
    ).join('');
    UI.openModal(`🍗 投喂 ${s.name}`, `
      <div style="margin-bottom:.75rem;color:var(--muted);font-size:.9rem">
        当前持有 <strong style="color:var(--warning)">${legs} 个</strong>鸡腿
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">${quickHtml}</div>
      <div class="form-field">
        <label class="form-label">自定义数量</label>
        <input id="feed-amount-val" type="number" min="1" max="${legs}" value="1"
          class="form-input" placeholder="输入投喂数量" style="max-width:160px">
      </div>
      <div id="feed-modal-err" style="color:var(--error,#ef4444);font-size:.85rem;min-height:1.1rem"></div>
      <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center">
        <button class="btn-sm btn-ghost" onclick="showRedeemForStudent('${id}')" style="color:var(--primary);padding: 0 .4rem;font-weight:600">🛒 返回兑换</button>
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`, { narrow: true });

    // 快捷按钮同步输入框
    document.querySelectorAll('.feed-quick-btn').forEach(btn => {
      btn.onclick = () => { document.getElementById('feed-amount-val').value = btn.dataset.val; };
    });

    document.getElementById('do-feed-btn').onclick = () => {
      const amount = parseInt(document.getElementById('feed-amount-val').value, 10);
      const errEl = document.getElementById('feed-modal-err');
      errEl.textContent = '';
      if (!amount || amount < 1) { errEl.textContent = '请输入有效数量'; return; }
      if (amount > legs) { errEl.textContent = `鸡腿不足，当前只有 ${legs} 个`; return; }

      const levelCfg = Store.levels.get(currentClassId);
      const oldLi = calcLevelInfo(s.fedLegs || 0, levelCfg);
      // Use batch feed instead of loop
      const feedRes = Store.students.feedChickenLegsCount(id, amount, `投喂鸡腿×${amount}`);
      const fed = feedRes.fed || 0;
      const updated = Store.students.find(id);
      const newLi = calcLevelInfo(updated.fedLegs || 0, levelCfg);
      const cardEl = document.querySelector(`.student-card[data-id="${id}"]`);
      UI.closeModal();
      Effects.floatFeed(cardEl);
      Effects.cardFeedPulse(cardEl);
      if (newLi.level > oldLi.level) {
        UI.toast(`🎉 投喂了 ${fed} 🍗，${s.name} 宠物升到 Lv.${newLi.level}「${newLi.title}」！`, 'success', 4000);
        playLevelUpOrMaxCelebration(id, s.name, s.petType, levelCfg, oldLi, newLi);
      } else {
        UI.toast(`🍗 成功投喂 ${fed} 个，${s.name} 还差 ${newLi.remaining} 🍗 升级`, 'success');
      }
      renderCard(id);
      if (document.getElementById('tab-records').classList.contains('active')) {
        Records.render(currentClassId);
      }
    };
  }

  /* ── Add/Edit Student Modal ── */
  function showAddModal() {
    const groups = Store.groups.byClass(currentClassId);
    // 完整 HTML（含宠物选项）一次性传入，避免 openModal 后再填充导致闪烁
    UI.openModal('➕ 增加学生', studentFormHtml(null, groups), { wide: true });
    UI.bindPetSelector('pet-selector');
    document.getElementById('save-student-btn').onclick = () => saveStudent();
  }

  function showEditModal(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const groups = Store.groups.byClass(currentClassId);
    UI.openModal(`✏️ 编辑：${s.name}`, studentFormHtml(s, groups), { wide: true });
    UI.bindPetSelector('pet-selector');
    document.getElementById('save-student-btn').onclick = () => saveStudent(id);
  }

  function showEditPetNameModal(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const html = `
    <div class="modal-form">
      <div class="form-field">
        <label>宠物名字</label>
        <input type="text" id="pet-name-input" value="${s.petName || ''}" placeholder="给宠物起个名字吧" maxlength="20" autofocus>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
        <button class="btn-primary" id="save-pet-name-btn">保存</button>
      </div>
    </div>`;
    UI.openModal(`🏷️ 修改宠物名：${s.name}`, html);
    document.getElementById('save-pet-name-btn').onclick = () => {
      const petName = document.getElementById('pet-name-input').value.trim();
      Store.students.update(id, { petName });
      UI.toast('宠物名字已更新', 'success');
      UI.closeModal();
      render();
    };
  }

  function studentFormHtml(s, groups) {
    const gOpts = groups.map(g => {
      const isSelected = s && (s.groupId === g.id || (s.groupIds && s.groupIds.includes(g.id)));
      return `<option value="${g.id}" ${isSelected ? 'selected' : ''}>${g.name}</option>`;
    }).join('');
    const petHtml = UI.petSelectorHtml(s ? s.petType : null);
    return `
    <div class="modal-form">
      <div class="modal-form-row">
        <div class="form-field">
          <label>学生姓名 *</label>
          <input type="text" id="s-name" value="${s ? s.name : ''}" placeholder="请输入姓名">
        </div>
      </div>
      ${groups.length ? `<div class="form-field">
        <label>所属小组</label>
        <select id="s-group">
          <option value="">不分组</option>
          ${gOpts}
        </select>
      </div>` : ''}
      <div class="form-field">
        <label>选择萌宠 *</label>
        <div id="pet-selector" class="pet-selector-grid">${petHtml}</div>
      </div>
      <div class="form-field">
        <label>宠物名字</label>
        <input type="text" id="s-pet-name" value="${s && s.petName ? s.petName : ''}" placeholder="给宠物起个名字吧（可选）" maxlength="20">
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
        <button class="btn-primary" id="save-student-btn">${s ? '保存' : '添加'}</button>
      </div>
    </div>`;
  }

  function saveStudent(id) {
    const name = document.getElementById('s-name').value.trim();
    const petType = UI.getSelectedPet('pet-selector');
    const petName = document.getElementById('s-pet-name').value.trim();
    const groupEl = document.getElementById('s-group');
    const groupId = groupEl ? groupEl.value || null : null;
    if (!name) { UI.toast('请输入学生姓名', 'warning'); return; }
    if (!petType) { UI.toast('请选择萌宠类型', 'warning'); return; }
    if (id) {
      const gIds = groupId ? [groupId] : [];
      Store.students.update(id, { name, petType, petName, groupId, groupIds: gIds });
      UI.toast('学生信息已更新', 'success');
    } else {
      const gIds = groupId ? [groupId] : [];
      Store.students.create({ classId: currentClassId, name, studentNo: '', petType, petName, groupId, groupIds: gIds });
      UI.toast(`${name} 已加入班级！`, 'success');
    }
    UI.closeModal();
    _switchToStudentsTab();
  }

  function _switchToStudentsTab() {
    // 激活学生列表标签页
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === 'students')
    );
    document.querySelectorAll('.tab-content').forEach(c =>
      c.classList.toggle('active', c.id === 'tab-students')
    );
    render();
  }

  /* ── Batch Add ── */
  let _excelRows = [];
  /** 未做自动分配前的行（用于切换「自动分配宠物」时重算） */
  let _excelRowsRaw = [];

  function excelCellStr(v) {
    if (v === undefined || v === null) return '';
    return String(v).trim();
  }

  function batchAutoAssignPetEnabled() {
    const el = document.getElementById('batch-auto-assign-pet');
    return !el || el.checked;
  }

  /* 为未指定宠物的学生分配动物，尽量不重复；人数多于动物数时可重复
     匹配顺序：从 PET_TYPES 列表末尾开始向前挑选（相同数量时优先选靠后的） */
  function assignPetsNoRepeat(rows, classId) {
    const count = {};
    PET_TYPES.forEach(p => { count[p.type] = 0; });
    Store.students.byClass(classId).forEach(s => {
      if (s.petType) count[s.petType] = (count[s.petType] || 0) + 1;
    });
    // 反转顺序，使自动匹配从最后面的宠物开始
    const pool = [...PET_TYPES].reverse();
    return rows.map(r => {
      if (r.petType) { count[r.petType] = (count[r.petType] || 0) + 1; return r; }
      const pick = pool.reduce((a, b) => (count[a.type] || 0) <= (count[b.type] || 0) ? a : b);
      count[pick.type] = (count[pick.type] || 0) + 1;
      return { ...r, petType: pick.type };
    });
  }

  function applyAutoAssignIfNeeded(rows) {
    if (batchAutoAssignPetEnabled()) return assignPetsNoRepeat(rows, currentClassId);
    return rows.map(r => ({ ...r, petType: r.petType || null }));
  }

  function matchPetToken(raw) {
    const t = excelCellStr(raw).toLowerCase();
    if (!t) return null;
    const p = PET_TYPES.find(x => x.type === t || x.name === t);
    return p ? p.type : null;
  }

  /** 表头单元格：去首尾空白、去掉尾部冒号与星号（Excel 常见「姓名：」） */
  function normalizeExcelHeader(v) {
    let s = excelCellStr(v);
    s = s.replace(/[\s\u3000]+/g, ' ').trim();
    s = s.replace(/[:：\*＊#＃]\s*$/, '').trim();
    return s;
  }

  function isNameHeaderCell(t) {
    const n = normalizeExcelHeader(t);
    return /^(姓名|学生姓名|名字|学生名字|名称|学生名称|name)$/i.test(n);
  }

  /** 过滤误把表头行当数据的一行 */
  function isLikelyImportedHeaderRowName(name) {
    return isNameHeaderCell(name);
  }

  function detectExcelHeaderStartRow(data) {
    const maxScan = Math.min(8, data.length);
    for (let i = 0; i < maxScan; i++) {
      const row = data[i] || [];
      const normed = row.map(normalizeExcelHeader);
      const h0 = normed[0] || '';
      if (isNameHeaderCell(h0)) return i + 1;
      if (/学号|编号|序号|考号|学籍/.test(h0) && normed[1] && /姓名|名字|学生姓名/.test(normed[1])) return i + 1;
      if (normed.some(isNameHeaderCell)) return i + 1;
      if (normed.some(t => /学号|编号|序号|考号|学籍/.test(t)) && normed.some(t => /姓名|名字|学生姓名|名称/.test(t))) return i + 1;
    }
    return 0;
  }

  /**
   * 无表头时：默认 A 序号、B 姓名、C 宠物。
   * 兼容旧表：首行 A 列已是中文姓名且像「姓名+宠物」两列时，仍按 A 姓名、B 宠物解析。
   */
  function inferNoHeaderColumnMapFromFirstRow(row) {
    const a = excelCellStr(row[0] || '');
    const b = excelCellStr(row[1] || '');
    const aHasChinese = /[\u4e00-\u9fff]/.test(a);
    const aLooksLikeSerial = a !== '' && /^[\d.\s]+$/.test(a.trim());
    const bPetOrEmpty =
      b === '' || matchPetToken(b) !== null || /^[a-z][a-z0-9_-]*$/i.test(b.trim());
    if (aHasChinese && !aLooksLikeSerial && bPetOrEmpty) {
      return { nameCol: 0, petCol: 1 };
    }
    return { nameCol: 1, petCol: 2 };
  }

  /** 根据表头推断列：姓名、宠物（忽略学号/序号等列）；无表头时默认 B 姓名、C 宠物 */
  function inferExcelColumnMap(data, startRow) {
    if (startRow === 0) {
      return inferNoHeaderColumnMapFromFirstRow(data[0] || []);
    }
    const h = (data[startRow - 1] || []).map(excelCellStr);
    const nh = h.map(normalizeExcelHeader);
    const idxName = nh.findIndex(isNameHeaderCell);
    const idxNo = nh.findIndex(t => /学号|编号|序号|考号|学籍/.test(t));
    const idxPet = nh.findIndex((t, j) => /宠物|萌宠|宠物类型|type/i.test(t) && !/备注/.test(h[j] || ''));
    if (idxName >= 0) {
      let petCol = idxPet >= 0 ? idxPet : -1;
      if (petCol < 0) {
        for (let c = idxName + 1; c < h.length; c++) {
          if (c === idxNo) continue;
          petCol = c;
          break;
        }
      }
      if (petCol === idxName) petCol = -1;
      return { nameCol: idxName, petCol };
    }
    if (idxNo === 0 && nh[1] && /姓名|名字/.test(nh[1])) {
      let petCol = idxPet >= 0 ? idxPet : (h.length > 2 ? 2 : -1);
      return { nameCol: 1, petCol };
    }
    return inferNoHeaderColumnMapFromFirstRow(data[startRow] || []);
  }

  function parseExcelDataRow(row, map) {
    const name = excelCellStr(row[map.nameCol]);
    const petRaw = map.petCol >= 0 ? excelCellStr(row[map.petCol]) : '';
    const petType = matchPetToken(petRaw);
    return { name, petType: petType || null };
  }

  function showBatchAdd() {
    _excelRows = [];
    _excelRowsRaw = [];
    UI.openModal('批量添加学生', batchAddHtml(), { wide: true });

    // Tab switching
    document.querySelectorAll('.batch-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.batch-tab').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.btab-content').forEach(c =>
          c.classList.toggle('active', c.id === `btab-${btn.dataset.btab}`)
        );
        document.getElementById('batch-preview').innerHTML = '';
      };
    });

    // Guide toggle
    document.getElementById('guide-toggle').onclick = () => {
      const body = document.getElementById('import-guide-body');
      const btn = document.getElementById('guide-toggle');
      const open = body.style.display === 'none';
      body.style.display = open ? 'block' : 'none';
      btn.textContent = open ? '收起 ▴' : '展开 ▾';
    };

    // Excel tab
    document.getElementById('excel-choose-btn').onclick = () =>
      document.getElementById('excel-file').click();
    document.getElementById('excel-file').onchange = e => {
      if (e.target.files[0]) processExcelFile(e.target.files[0]);
    };
    document.getElementById('excel-download-tpl').onclick = downloadExcelTemplate;

    // Drag & drop
    const dz = document.getElementById('excel-drop-zone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) processExcelFile(e.dataTransfer.files[0]);
    });

    // Text tab
    document.getElementById('batch-text').oninput = updateBatchPreview;
    document.getElementById('do-batch-btn').onclick = doBatchAdd;

    const autoPetCb = document.getElementById('batch-auto-assign-pet');
    if (autoPetCb) {
      autoPetCb.onchange = () => {
        if (_excelRowsRaw.length) {
          _excelRows = applyAutoAssignIfNeeded(_excelRowsRaw.map(r => ({ ...r })));
          const activeTab = document.querySelector('.batch-tab.active');
          if (activeTab && activeTab.dataset.btab === 'excel') renderBatchPreview(_excelRows);
        } else {
          updateBatchPreview();
        }
      };
    }
  }

  function batchAddHtml() {
    const petRef = PET_TYPES.map(p =>
      `<span class="pet-ref-tag" title="${p.name}">${p.type}<em>${p.name}</em></span>`
    ).join('');

    return `
    <div class="batch-tabs">
      <button class="batch-tab active" data-btab="excel">📊 Excel 导入</button>
      <button class="batch-tab" data-btab="text">📝 文本输入</button>
    </div>

    <!-- Excel tab -->
    <div id="btab-excel" class="btab-content active">
      <div class="excel-upload-area" id="excel-drop-zone">
        <div class="excel-upload-icon">📊</div>
        <p>将 Excel 文件拖入此处，或点击按钮选择文件</p>
        <p style="font-size:.75rem;color:var(--text-light);margin:.25rem 0 .75rem">支持 .xlsx / .xls 格式</p>
        <button class="btn-ghost btn-sm" id="excel-choose-btn">📂 选择文件</button>
        <input type="file" id="excel-file" accept=".xlsx,.xls" style="display:none">
      </div>
      <!-- Excel format guide -->
      <div class="import-guide">
        <div class="import-guide-header">
          <span class="import-guide-icon">📋</span>
          <span>Excel 格式说明</span>
          <button class="guide-toggle" id="guide-toggle">展开 ▾</button>
        </div>
        <div class="import-guide-body" id="import-guide-body" style="display:none">
          <div class="import-table-wrap">
            <table class="import-example-table">
              <thead>
                <tr>
                  <th>A列&nbsp;序号&nbsp;<span class="col-optional">可选</span></th>
                  <th>B列&nbsp;姓名&nbsp;<span class="col-required">必填</span></th>
                  <th>C列&nbsp;宠物类型&nbsp;<span class="col-optional">可选</span></th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>1</td><td>张三</td><td>cat</td><td>猫咪</td></tr>
                <tr><td>2</td><td>李四</td><td>dog</td><td>狗狗</td></tr>
                <tr><td>3</td><td>王五</td><td>panda</td><td>熊猫</td></tr>
              </tbody>
            </table>
          </div>
          <div class="import-tips">
            <p>💡 <b>表头</b>支持「姓名」「学生姓名」「名字」等；带冒号（如「姓名：」）也能识别。首行若是班级标题，会在前几行内自动找到表头行</p>
            <p>💡 <b>宠物类型</b>不填或无法识别时：勾选「自动分配宠物」则系统分配；关闭则导入后由学生手动领养</p>
          </div>
          <div class="pet-ref-section">
            <p class="pet-ref-title">全部宠物类型（复制英文名填入「宠物」列；无表头时一般为 C 列，A 为序号、B 为姓名）：</p>
            <div class="pet-ref-list">${petRef}</div>
          </div>
        </div>
      </div>
      <div class="batch-template-hint">
        <button class="btn-ghost btn-sm" id="excel-download-tpl">⬇️ 下载导入模板</button>
        <span class="tpl-hint-text">模板含示例数据和全部宠物类型对照表</span>
      </div>
    </div>

    <!-- Text tab -->
    <div id="btab-text" class="btab-content">
      <div class="text-import-guide">
        <div class="text-format-box">
          <div class="text-format-title">📝 格式说明</div>
          <div class="text-format-rule">每行一名学生，字段用英文逗号 <code>,</code> 分隔</div>
          <code class="text-format-tmpl">姓名 , 宠物类型（可空，英文 type）</code>
        </div>
        <div class="text-example-box">
          <div class="text-format-title">✏️ 示例</div>
          <pre class="text-example-pre">张三,cat
李四,dog
王五,panda
赵六,</pre>
          <p class="text-example-note">↑ 宠物类型可留空（行末可只写姓名）</p>
        </div>
      </div>
      <textarea class="batch-textarea" id="batch-text"
        placeholder="张三,cat&#10;李四,dog&#10;王五,panda"></textarea>
    </div>

    <div id="batch-preview" class="batch-preview-list"></div>
    <div class="batch-options" style="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem .75rem;padding:.35rem 0 .25rem;font-size:.95rem;color:#b71c1c">
      <label class="share-switch-wrapper batch-auto-assign-switch" style="font-weight:800;color:#b71c1c">
        <input type="checkbox" id="batch-auto-assign-pet" checked>
        <span class="share-switch-slider"></span>
        <span class="share-switch-text" style="color:#b71c1c;font-weight:800">自动分配宠物</span>
      </label>
      <span style="font-size:.95rem;font-weight:800;color:#b71c1c">关闭后导入的学生需各自点击「领养」选择宠物</span>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
      <button class="btn-primary" id="do-batch-btn">确认导入</button>
    </div>`;
  }

  /* Excel file processing */
  function processExcelFile(file) {
    const runParse = () => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

          const startRow = detectExcelHeaderStartRow(data);
          const colMap = inferExcelColumnMap(data, startRow);

          const rawRows = data.slice(startRow).map(row => parseExcelDataRow(row, colMap))
            .filter(r => r.name && !isLikelyImportedHeaderRowName(r.name));
          _excelRowsRaw = rawRows.map(r => ({ ...r }));
          _excelRows = applyAutoAssignIfNeeded(rawRows.map(r => ({ ...r })));

          const dz = document.getElementById('excel-drop-zone');
          if (_excelRows.length === 0) {
            dz.innerHTML = `<div style="color:var(--warning);font-size:1.5rem">⚠️</div>
            <p>未识别到有效数据，请检查姓名列（有表头时认「姓名」列；无表头时一般为 B 列）是否填写</p>
            <button class="btn-ghost btn-sm" id="excel-choose-btn">重新选择</button>
            <input type="file" id="excel-file" accept=".xlsx,.xls" style="display:none">`;
            document.getElementById('excel-choose-btn').onclick = () =>
              document.getElementById('excel-file').click();
            document.getElementById('excel-file').onchange = e => {
              if (e.target.files[0]) processExcelFile(e.target.files[0]);
            };
            return;
          }

          dz.innerHTML = `
          <div style="color:var(--success);font-size:2rem">✅</div>
          <p>「${file.name}」</p>
          <p style="font-weight:700;color:var(--success)">成功读取 ${_excelRows.length} 名学生</p>
          <button class="btn-ghost btn-sm" id="excel-choose-btn">重新选择文件</button>
          <input type="file" id="excel-file" accept=".xlsx,.xls" style="display:none">`;
          document.getElementById('excel-choose-btn').onclick = () =>
            document.getElementById('excel-file').click();
          document.getElementById('excel-file').onchange = e => {
            if (e.target.files[0]) processExcelFile(e.target.files[0]);
          };

          renderBatchPreview(_excelRows);
        } catch (err) {
          UI.toast('文件解析失败，请确认是有效的 Excel 文件', 'error');
        }
      };
      reader.readAsBinaryString(file);
    };
    if (typeof XLSX !== 'undefined') {
      runParse();
      return;
    }
    UI.toast('正在加载 Excel 库…', 'info', 2000);
    const p = typeof loadXLSX === 'function' ? loadXLSX() : Promise.reject(new Error('loadXLSX'));
    p.then(() => {
      if (typeof XLSX !== 'undefined') runParse();
      else UI.toast('Excel 库加载失败，请检查网络后重试', 'error');
    }).catch(() => UI.toast('Excel 库加载失败，请检查网络后重试', 'error'));
  }

  /* Download template */
  async function downloadExcelTemplate() {
    try {
      if (typeof XLSX === 'undefined') {
        UI.toast('正在加载 Excel 库…', 'info', 2000);
        await (typeof loadXLSX === 'function' ? loadXLSX() : Promise.reject(new Error('loadXLSX')));
      }
      if (typeof XLSX === 'undefined') {
        UI.toast('Excel 库加载失败，请检查网络后重试', 'error');
        return;
      }
    } catch (e) {
      UI.toast('Excel 库加载失败，请检查网络后重试', 'error');
      return;
    }
    const header = ['序号', '姓名', '宠物类型（填英文type）', '备注（可不填）'];
    const examples = [
      [1, '张三', 'cat', '猫咪'],
      [2, '李四', 'dog', '狗狗'],
      [3, '王五', 'panda', '熊猫'],
    ];
    const divider = ['', '', '', ''];
    const hint = ['--- 宠物类型参考（复制 type 列）---', '', '', ''];
    const petRows = PET_TYPES.map(p => ['', p.type, p.name, '']);

    const ws = XLSX.utils.aoa_to_sheet([header, ...examples, divider, hint, ...petRows]);
    // Column widths
    ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 20 }];
    // Bold header style hint (SheetJS community doesn't support full styling but set freeze)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '学生信息');
    XLSX.writeFile(wb, '萌宠系统_学生导入模板.xlsx');
    UI.toast('模板已下载', 'success');
  }

  function parseBatchLines() {
    const lines = (document.getElementById('batch-text').value || '').split('\n');
    const rows = lines.map(l => {
      const parts = l.trim().split(',');
      const name = excelCellStr(parts[0]);
      const petRaw = excelCellStr(parts[1] || '');
      if (!name) return null;
      const petType = matchPetToken(petRaw);
      return { name, petType: petType || null };
    }).filter(Boolean);
    return applyAutoAssignIfNeeded(rows);
  }

  function updateBatchPreview() {
    renderBatchPreview(parseBatchLines());
  }

  function renderBatchPreview(rows) {
    const container = document.getElementById('batch-preview');
    if (!container) return;
    if (rows.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML =
      `<p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.4rem">预览 <b>${rows.length}</b> 名学生：</p>` +
      rows.map(r => {
        if (!r.petType) {
          return `<div class="batch-preview-item">
        <span class="bpi-pet" style="font-size:1.35rem;line-height:1;opacity:.55" aria-hidden="true">🐾</span>
        <span style="font-weight:600">${r.name}</span>
        <span style="color:var(--text-muted);font-size:.8rem">待领养</span>
      </div>`;
        }
        const p = getPet(r.petType);
        return `<div class="batch-preview-item">
        <img src="${getPetImg(r.petType, 1)}" class="bpi-pet" onerror="this.style.display='none'">
        <span style="font-weight:600">${r.name}</span>
        <span style="color:var(--primary);font-size:.8rem">${p.emoji} ${p.name}</span>
      </div>`;
      }).join('');
  }

  function doBatchAdd() {
    const activeTab = document.querySelector('.batch-tab.active');
    const mode = activeTab ? activeTab.dataset.btab : 'text';
    const rows = mode === 'excel' ? _excelRows : parseBatchLines();
    if (rows.length === 0) { UI.toast('请先选择文件或输入学生信息', 'warning'); return; }
    const t0 = new Date().toISOString();
    rows.forEach(r => Store.students.create({
      classId: currentClassId,
      name: r.name,
      studentNo: '',
      petType: r.petType,
      lastPetFedAt: r.petType ? t0 : null,
    }));
    UI.closeModal();
    UI.toast(`🎉 成功导入 ${rows.length} 名学生`, 'success');
    _excelRows = [];
    _excelRowsRaw = [];
    _switchToStudentsTab();
  }

  /* ── Medal Wall ── */
  /* ── 颁发徽章 ── */
  function showAwardMedal(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const presets = ['🏅', '🥇', '🥈', '🥉', '⭐', '🌟', '🎖️', '🏆', '🎗️', '🌈', '💫', '🔥', '👑', '💎', '🎯'];
    UI.openModal(`🏅 颁发徽章 — ${s.name}`, `
      <div class="modal-form">
        <div class="form-field">
          <label>选择图标</label>
          <div class="medal-icon-picker" id="medal-icon-picker">
            ${presets.map(ic => `
              <button type="button" class="medal-icon-btn ${ic === '🏅' ? 'selected' : ''}"
                data-icon="${ic}">${ic}</button>`).join('')}
          </div>
          <input type="hidden" id="award-icon-val" value="🏅">
        </div>
        <div class="form-field">
          <label>徽章名称 *</label>
          <input type="text" id="award-title" placeholder="例：进步之星、最佳发言、数学达人" class="form-input">
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
          <button class="btn-primary" id="do-award-btn">🏅 颁发</button>
        </div>
      </div>`, { narrow: true });

    // 图标选择
    document.querySelectorAll('.medal-icon-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.medal-icon-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('award-icon-val').value = btn.dataset.icon;
      };
    });

    document.getElementById('do-award-btn').onclick = () => {
      const title = document.getElementById('award-title').value.trim();
      const icon = document.getElementById('award-icon-val').value;
      if (!title) { UI.toast('请输入徽章名称', 'warning'); return; }
      const medals = [...(Store.students.find(id).medals || []),
      { title, icon, date: new Date().toISOString() }];
      Store.students.update(id, { medals });
      UI.closeModal();
      UI.toast(`🏅 已为 ${s.name} 颁发「${title}」`, 'success');
      renderCard(id);
    };
  }

  /* ── 删除徽章 ── */
  function showDeleteMedal(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const medals = s.medals || [];
    if (medals.length === 0) { UI.toast('该学生暂无徽章', 'info'); return; }

    const renderList = (sid) => {
      const st = Store.students.find(sid);
      const ms = (st||{}).medals || [];
      const list = document.getElementById('delete-medal-list');
      if (!list) return;
      if (ms.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1.5rem">已全部删除</p>';
        return;
      }
      list.innerHTML = ms.map((m, i) => `
        <div class="del-medal-row">
          <span class="del-medal-icon">${m.icon || '🏅'}</span>
          <div class="del-medal-info">
            <div class="del-medal-title">${m.title}</div>
            <div class="del-medal-date">${timeAgo(m.date)}</div>
          </div>
          <button class="btn-sm btn-danger-sm del-medal-btn" data-idx="${i}" data-sid="${sid}">删除</button>
        </div>`).join('');
      list.querySelectorAll('.del-medal-btn').forEach(btn => {
        btn.onclick = () => {
          const cur = Store.students.find(btn.dataset.sid);
          const newMedals = (cur.medals || []).filter((_, i) => i !== +btn.dataset.idx);
          Store.students.update(btn.dataset.sid, { medals: newMedals });
          renderList(btn.dataset.sid);
          renderCard(btn.dataset.sid);
        };
      });
    };

    UI.openModal(`🗑️ 删除徽章 — ${s.name}`, `
      <div id="delete-medal-list" style="max-height:360px;overflow-y:auto"></div>
      <div class="modal-footer" style="margin-top:.5rem">
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`);
    renderList(id);
  }

  /* ── 兑换商品 ── */
  function showRedeemForStudent(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const items = Store.shop.byClass(currentClassId);

    if (items.length === 0) {
      UI.toast('商城暂无商品', 'info'); return;
    }

    const renderItems = (filter) => {
      const box = document.getElementById('redeem-items-box');
      if (!box) return;
      const cur = Store.students.find(id);
      const welfare = getLeaderboardWelfareScore(cur);
      const filtered = items.filter(it => {
        if (it.stock === 0) return false;
        if (filter === 'affordable') return it.price <= welfare;
        return true;
      });
      if (filtered.length === 0) {
        box.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem">
          ${filter === 'affordable' ? '积分不足，无可兑换商品' : '暂无可用商品'}</p>`;
        return;
      }
      box.innerHTML = filtered.map(it => {
        const canAfford = welfare >= it.price;
        const stockStr = it.stock < 0 ? '' : `库存: ${it.stock}`;
        const maxQty = it.stock < 0 ? 99 : it.stock;
        const iconHtml = (it.icon || '').startsWith('ri-') ? `<i class="ri ${it.icon}" aria-hidden="true"></i>` : (it.icon || '🎁');
        return `<div class="redeem-item-row ${canAfford ? '' : 'redeem-item-row--poor'}">
          <span class="redeem-item-icon">${iconHtml}</span>
          <div class="redeem-item-info">
            <div class="redeem-item-name">${it.name}</div>
            <div class="redeem-item-meta">🏆 ${it.price} 积分${stockStr ? '　' + stockStr : ''}</div>
          </div>
          ${canAfford
            ? `<div style="display:flex;align-items:center;gap:.35rem">
                <input type="number" class="redeem-qty-input" data-item="${it.id}" value="1" min="1" max="${maxQty}"
                  style="width:52px;padding:.2rem .35rem;border:1.5px solid var(--border);border-radius:6px;font-size:.85rem;text-align:center">
                <button class="btn-sm btn-primary-sm do-redeem-item" data-item="${it.id}">兑换</button>
               </div>`
            : `<span style="font-size:.75rem;color:var(--text-muted)">积分不足</span>`
          }
        </div>`;
      }).join('');
      box.querySelectorAll('.do-redeem-item').forEach(btn => {
        btn.onclick = () => {
          const itemId = btn.dataset.item;
          const qtyInput = box.querySelector(`.redeem-qty-input[data-item="${itemId}"]`);
          const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : 1) || 1);
          const item = Store.shop.find(itemId);
          if (!item) return;

          const latestCur = Store.students.find(id);
          const latestWelfare = getLeaderboardWelfareScore(latestCur);
          const totalCost = item.price * qty;

          if (item.stock >= 0 && item.stock < qty) {
            UI.toast(`库存不足，当前剩余 ${item.stock} 件`, 'warning');
            return;
          }
          if (latestWelfare < totalCost) {
            UI.toast(`积分不足，需要 ${totalCost} 积分，当前 ${latestWelfare} 积分`, 'warning');
            return;
          }

          let allOk = true;
          for (let i = 0; i < qty; i++) {
            const result = Store.shop.redeem(itemId, id);
            if (!result.ok) {
              UI.toast(result.msg, 'error');
              allOk = false;
              break;
            }
          }

          if (allOk) {
            UI.toast(`✅ ${s.name} 兑换「${item.name}」成功！${qty > 1 ? '共 ' + qty + ' 件' : ''}`, 'success');
            renderItems(filter);
            renderCard(id);
            const balanceEl = document.getElementById('redeem-balance-val');
            if (balanceEl) {
              const updatedCur = Store.students.find(id);
              balanceEl.textContent = getLeaderboardWelfareScore(updatedCur);
            }
            if (document.getElementById('tab-records').classList.contains('active')) {
              Records.render(currentClassId);
            }
          }
        };
      });
    };

    const cur = Store.students.find(id);
    const welfare = getLeaderboardWelfareScore(cur);
    UI.openModal(`🛒 兑换商品 — ${s.name}`, `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
        <span style="font-size:.85rem;color:var(--text-muted)">当前积分余额：
          <b style="color:var(--primary)"> 🏆 <span id="redeem-balance-val">${welfare}</span> 积分</b>
        </span>
        <div style="display:flex;gap:.4rem">
          <button class="btn-sm btn-ghost redeem-filter-btn active" data-filter="affordable">仅可兑换</button>
          <button class="btn-sm btn-ghost redeem-filter-btn" data-filter="all">全部商品</button>
        </div>
      </div>
      <div id="redeem-items-box" style="max-height:380px;overflow-y:auto"></div>
      <div class="modal-footer" style="margin-top:.5rem;display:flex;justify-content:space-between;align-items:center">
        <button class="btn-sm btn-ghost" onclick="Students.showRedeemRecords('${id}')" style="color:var(--primary);padding: 0 .4rem;font-weight:600">📋 兑换记录</button>
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`);

    renderItems('affordable');
    document.querySelectorAll('.redeem-filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.redeem-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderItems(btn.dataset.filter);
      };
    });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function formatStickerWallDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
  }

  function safeFilePart(name) {
    return String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'export';
  }

  function buildStickerWallSection(s, opts = {}) {
    const inlineClose = !!opts.inlineClose;
    const entries = getMedalWallPetEntries(s);
    const hasEntries = entries.length > 0;
    let gridPart = '';
    if (!hasEntries) {
      gridPart = `<div class="bw-empty-block">
        <div class="bw-empty">暂无满级萌宠贴纸。</div>
        <p class="bw-empty-hint">宠物升到满级时，在「养成成功」弹窗中点击「召唤神兽」即可保存；召唤神兽后的记录也会显示在这里。</p>
      </div>`;
    } else {
      gridPart = `<div class="bw-grid" id="bw-sticker-grid" role="listbox" aria-label="萌宠贴纸">
        ${entries.map((e, i) => {
        const name = e.petName || (getPet(e.petType)||{}). name || '';
        const em = (getPet(e.petType)||{}). emoji || '🐾';
        const src = e.imgPath || '';
        const dateStr = formatStickerWallDate(e.date);
        return `<div class="bw-item" role="option" tabindex="0" data-index="${i}" aria-selected="false" title="双击查看高清白底大图">
            <span class="bw-name">${escHtml(name)}</span>
            <div class="bw-ring-wrap">
              <span class="bw-sparkle bw-sparkle--1" aria-hidden="true">✦</span>
              <span class="bw-sparkle bw-sparkle--2" aria-hidden="true">✧</span>
              <span class="bw-sparkle bw-sparkle--3" aria-hidden="true">✦</span>
              <div class="bw-ring">
                <img src="${src}" alt="" class="bw-img"
                  onerror="this.style.display='none';var n=this.nextElementSibling;if(n)n.style.display='flex'">
                <span class="bw-fallback" style="display:none" aria-hidden="true">${em}</span>
              </div>
            </div>
            <span class="bw-date">${escHtml(dateStr)}</span>
          </div>`;
      }).join('')}
      </div>`;
    }
    const closeBtn = inlineClose
      ? '<button type="button" class="btn-ghost" onclick="UI.closeModal()">关闭</button>'
      : '';
    return `<div class="bw-wall" data-student-id="${s.id}">
      <p class="bw-hint">点击选择一张贴纸，再导出为 PNG 或生成奖状；<span style="color:#e53e3e;font-weight:700">双击可查看高清白底大图</span></p>
      ${gridPart}
      <div class="bw-export-row">
        <button type="button" class="btn-sm btn-primary" id="bw-btn-png" ${!hasEntries ? 'disabled' : ''}>🖼️ 导出贴纸</button>
        <button type="button" class="btn-sm btn-warning" id="bw-btn-cert" ${!hasEntries ? 'disabled' : ''}>📜 生成奖状</button>
        <button type="button" class="btn-sm btn-ghost" id="bw-btn-list" ${!hasEntries ? 'disabled' : ''}>📋 导出清单</button>
        <button type="button" class="btn-sm btn-danger" id="bw-btn-delete" ${!hasEntries ? 'disabled' : ''} style="margin-left:auto">🗑️ 删除贴纸</button>
        ${closeBtn}
      </div>
    </div>`;
  }

  function canvasRoundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function exportStickerWallList(s) {
    const entries = getMedalWallPetEntries(s);
    const lines = [
      `${s.name} 的徽章墙 · 导出清单`,
      `导出时间：${new Date().toLocaleString('zh-CN')}`,
      '',
      ...entries.map((e, i) => {
        const name = e.petName || (getPet(e.petType)||{}). name || '';
        const from = e._from === 'summon' ? '召唤神兽' : '召唤神兽';
        return `${i + 1}.\t${name}\t${formatStickerWallDate(e.date)}\t${from}`;
      }),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeFilePart(s.name)}-徽章清单.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    UI.toast('已导出清单', 'success');
  }

  function drawStickerExportCanvas(ctx, W, H, entry, studentName, img, customText = '') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const petName = entry.petName || (getPet(entry.petType)||{}). name || '';
    const dateStr = formatStickerWallDate(entry.date);
    const cx = W / 2;
    const cy = 225;
    const r = 148;

    ctx.font = '600 17px system-ui, "Segoe UI", sans-serif';
    const tw = ctx.measureText(petName).width;
    const pillW = Math.min(tw + 32, W - 48);
    const px = (W - pillW) / 2;
    ctx.fillStyle = '#f5e8d8';
    canvasRoundRect(ctx, px, 28, pillW, 32, 10);
    ctx.fill();
    ctx.fillStyle = '#4b3f35';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(petName, cx, 44);

    const drawRing = () => {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, '#fbbf24');
      g.addColorStop(0.5, '#f59e0b');
      g.addColorStop(1, '#ea580c');
      ctx.strokeStyle = g;
      ctx.lineWidth = 6;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    if (img && img.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max((2 * r) / iw, (2 * r) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fffaf0';
      ctx.fill();
      ctx.font = '96px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#333';
      ctx.fillText((getPet(entry.petType)||{}). emoji || '🐾', cx, cy);
      ctx.restore();
    }
    drawRing();

    // 绘制日期
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(dateStr, cx, H - 112);
    
    // 如果有自定义文字，绘制精美气泡
    if (customText && customText.trim()) {
      const bubbleY = H - 170; // 日期上方位置，稍微下调一点
      ctx.font = '600 16px "Microsoft YaHei", "PingFang SC", system-ui, sans-serif';
      const textWidth = ctx.measureText(customText).width;
      const bubbleW = textWidth + 40;
      const bubbleH = 36;
      const bubbleX = (W - bubbleW) / 2;
      
      // 绘制气泡阴影
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      
      // 绘制气泡主体（圆角矩形）
      ctx.fillStyle = '#fff5e6';
      canvasRoundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 18);
      ctx.fill();
      
      // 绘制气泡边框（渐变效果）
      const borderGrad = ctx.createLinearGradient(bubbleX, bubbleY, bubbleX + bubbleW, bubbleY + bubbleH);
      borderGrad.addColorStop(0, '#fbbf24');
      borderGrad.addColorStop(0.5, '#f59e0b');
      borderGrad.addColorStop(1, '#fb923c');
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 2;
      canvasRoundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 18);
      ctx.stroke();
      
      ctx.restore();
      
      // 绘制气泡尖角（指向日期）
      ctx.fillStyle = '#fff5e6';
      ctx.beginPath();
      ctx.moveTo(cx, bubbleY + bubbleH);
      ctx.lineTo(cx - 6, bubbleY + bubbleH);
      ctx.lineTo(cx, bubbleY + bubbleH + 8);
      ctx.lineTo(cx + 6, bubbleY + bubbleH);
      ctx.closePath();
      ctx.fill();
      
      // 绘制尖角边框
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 6, bubbleY + bubbleH);
      ctx.lineTo(cx, bubbleY + bubbleH + 8);
      ctx.lineTo(cx + 6, bubbleY + bubbleH);
      ctx.stroke();
      
      // 绘制文字
      ctx.fillStyle = '#92400e';
      ctx.font = '600 16px "Microsoft YaHei", "PingFang SC", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(customText, cx, bubbleY + bubbleH / 2);
    }
    
    ctx.fillStyle = '#374151';
    ctx.font = '600 22px system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`${studentName} · 徽章墙`, cx, H - 76);
  }

  function runStickerWallPngExport(studentId) {
    const s = Store.students.find(studentId);
    if (!s) return;
    const sel = document.querySelector('#bw-sticker-grid .bw-item.is-selected');
    if (!sel) {
      UI.toast('请先点击选择一张贴纸', 'warning');
      return;
    }
    const idx = Number(sel.dataset.index);
    const entries = getMedalWallPetEntries(s);
    const entry = entries[idx];
    if (!entry) return;

    // 创建自定义输入框弹窗
    const overlay = document.createElement('div');
    overlay.className = 'si-custom-overlay';
    overlay.style.zIndex = '300001'; // 设置超高层级，确保显示在徽章墙(200000)之上
    overlay.innerHTML = `
      <div class="si-custom-card" style="max-width: 400px;">
        <div class="si-custom-card-header">
          <span class="si-custom-card-title">✍️ 为贴纸添加寄语</span>
          <button type="button" class="si-custom-card-close" title="关闭">✕</button>
        </div>
        <div class="si-custom-card-body">
          <div class="si-custom-field">
            <label>寄语文字 <span class="si-custom-optional">(可选)</span></label>
            <input type="text" id="sticker-custom-text" placeholder="留空则不显示寄语" maxlength="30">
            <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted);">💡 文字会显示在日期上方的精美气泡中</p>
          </div>
        </div>
        <div class="si-custom-card-footer">
          <button type="button" class="si-custom-confirm si-custom-confirm-add" id="sticker-export-confirm">确定导出</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const closeOverlay = () => overlay.remove();
    overlay.querySelector('.si-custom-card-close').onclick = closeOverlay;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    const textInput = overlay.querySelector('#sticker-custom-text');
    setTimeout(() => textInput.focus(), 50);

    // 确定按钮
    const doExport = () => {
      const customText = textInput.value.trim();
      closeOverlay();

      const W = 420;
      const H = 560;
      const DPR = 3;
      const canvas = document.createElement('canvas');
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      const ctx = canvas.getContext('2d');
      ctx.scale(DPR, DPR);

      const finishExport = (imgToUse) => {
        drawStickerExportCanvas(ctx, W, H, entry, s.name, imgToUse, customText);
        canvas.toBlob((blob) => {
          if (!blob) {
            UI.toast('导出失败', 'error');
            return;
          }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          const pn = entry.petName || (getPet(entry.petType)||{}). name || '贴纸';
          a.download = `${safeFilePart(s.name)}-${safeFilePart(pn)}-徽章.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          UI.toast('已导出 PNG', 'success');
        }, 'image/png');
      };

      if (!entry.imgPath) {
        finishExport(null);
        return;
      }

      const isRemote = /^https?:\/\//i.test(entry.imgPath);

      const loadAndFinish = (src, useProxy) => {
        const img = new Image();
        img.onload = () => finishExport(img);
        img.onerror = () => finishExport(null);
        if (useProxy) {
          loadImageViaProxy(src).then(base64Data => {
            if (base64Data) {
              img.src = base64Data;
            } else {
              finishExport(null);
            }
          });
        } else {
          // 本地同源图片：直接加载，无需代理
          img.src = src;
        }
      };

      if (isRemote) {
        loadAndFinish(entry.imgPath, true);
      } else {
        loadAndFinish(entry.imgPath, false);
      }
    };

    overlay.querySelector('#sticker-export-confirm').onclick = doExport;

    // Enter 快速确定
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doExport();
      if (e.key === 'Escape') closeOverlay();
    });
  }

  function showStickerHDPreview(entry) {
    const petName = entry.petName || (getPet(entry.petType) || {}).name || '宠物';
    const em = (getPet(entry.petType) || {}).emoji || '🐾';
    const rawSrc = entry.imgPath || '';
    // 优先使用 .png 无损原图以获得更清晰的效果；若不存在自动回退到 .webp
    const hdSrc = rawSrc.replace(/\.webp(\?.*)?$/i, '.png$1');
    const dateStr = formatStickerWallDate(entry.date);
    const overlay = document.createElement('div');
    overlay.className = 'sticker-hd-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', `${petName} 高清大图`);
    overlay.innerHTML = `
      <div class="sticker-hd-box" role="document">
        <button type="button" class="sticker-hd-close" aria-label="关闭">✕</button>
        <div class="sticker-hd-title">${escHtml(petName)}</div>
        <div class="sticker-hd-imgwrap">
          <img src="" data-original-src="${hdSrc}" data-fallback="${rawSrc}" alt="${escHtml(petName)}" class="sticker-hd-img">
          <span class="sticker-hd-fallback" style="display:none">${em}</span>
        </div>
        <div class="sticker-hd-meta">${escHtml(dateStr)}　·　拍照记录使用</div>
      </div>`;
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '2147483647', padding: '20px', cursor: 'zoom-out'
    });
    const box = overlay.querySelector('.sticker-hd-box');
    Object.assign(box.style, {
      background: '#ffffff', borderRadius: '18px', padding: '28px 32px 22px',
      maxWidth: '96vw', maxHeight: '96vh',
      display: 'inline-flex', flexDirection: 'column',
      alignItems: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
      position: 'relative', cursor: 'default'
    });
    const closeBtn = overlay.querySelector('.sticker-hd-close');
    Object.assign(closeBtn.style, {
      position: 'absolute', top: '12px', right: '16px', border: 'none',
      background: 'transparent', fontSize: '26px', color: '#666',
      cursor: 'pointer', lineHeight: '1', padding: '4px 10px'
    });
    const title = overlay.querySelector('.sticker-hd-title');
    Object.assign(title.style, {
      fontSize: '22px', fontWeight: '700', color: '#222',
      marginBottom: '14px', textAlign: 'center'
    });
    const imgWrap = overlay.querySelector('.sticker-hd-imgwrap');
    Object.assign(imgWrap.style, {
      background: '#ffffff', display: 'flex', alignItems: 'center',
      justifyContent: 'center', overflow: 'hidden'
    });
    const imgEl = overlay.querySelector('.sticker-hd-img');
    // 根据宠物图片自然宽高按比例放大；使用代理加载以避免CORS问题
    Object.assign(imgEl.style, {
      display: 'block', background: '#ffffff',
      width: 'auto', height: 'auto',
      maxWidth: '94vw', maxHeight: '86vh',
      objectFit: 'contain'
    });
    // 关闭浏览器降采样插值，让原始像素细节清晰呈现
    imgEl.style.setProperty('image-rendering', 'high-quality');
    imgEl.setAttribute('decoding', 'sync');
    imgEl.setAttribute('loading', 'eager');
    // 图片加载完成后，按自然宽高比放大到目标尺寸（尽可能接近原始像素以保证超清）
    const sizeToNatural = () => {
      const nw = imgEl.naturalWidth;
      const nh = imgEl.naturalHeight;
      if (!nw || !nh) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 允许放大到 94vw / 82vh，且优先保留原图分辨率上限 → 更加清晰锐利
      const maxW = Math.min(vw * 0.94, Math.max(nw, 1200));
      const maxH = Math.min(vh * 0.82, Math.max(nh, 1200));
      const scale = Math.min(maxW / nw, maxH / nh);
      const w = Math.round(nw * scale);
      const h = Math.round(nh * scale);
      imgEl.style.width = w + 'px';
      imgEl.style.height = h + 'px';
    };
    if (imgEl.complete && imgEl.naturalWidth) sizeToNatural();
    else imgEl.addEventListener('load', sizeToNatural);
    const fb = overlay.querySelector('.sticker-hd-fallback');
    Object.assign(fb.style, {
      fontSize: '220px', color: '#999', alignItems: 'center', justifyContent: 'center'
    });
    const meta = overlay.querySelector('.sticker-hd-meta');
    Object.assign(meta.style, {
      marginTop: '14px', fontSize: '14px', color: '#777'
    });
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (ev) => { if (ev.key === 'Escape') close(); };
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close();
    });
    closeBtn.onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    
    const hideAndShowFallback = () => {
      imgEl.style.display = 'none';
      const n = imgEl.nextElementSibling;
      if (n) n.style.display = 'flex';
    };
    const isRemote = /^https?:\/\//i.test(rawSrc);
    const tryLoad = (src) => {
      if (isRemote) {
        loadImageViaProxy(src).then(base64Data => {
          if (base64Data) {
            imgEl.src = base64Data;
          } else if (src !== rawSrc) {
            tryLoad(rawSrc);
          } else {
            hideAndShowFallback();
          }
        });
      } else {
        // 本地同源图片：直接加载
        imgEl.onerror = () => {
          if (src === hdSrc && rawSrc !== hdSrc) {
            tryLoad(rawSrc);
          } else {
            hideAndShowFallback();
          }
        };
        imgEl.src = src;
      }
    };
    tryLoad(hdSrc);
  }

  function bindStickerWallInteractions(studentId) {
    const grid = document.getElementById('bw-sticker-grid');
    const pngBtn = document.getElementById('bw-btn-png');
    const listBtn = document.getElementById('bw-btn-list');
    if (grid) {
      grid.onclick = (e) => {
        const item = e.target.closest('.bw-item');
        if (!item) return;
        grid.querySelectorAll('.bw-item').forEach((el) => {
          el.classList.remove('is-selected');
          el.setAttribute('aria-selected', 'false');
        });
        item.classList.add('is-selected');
        item.setAttribute('aria-selected', 'true');
      };
      grid.ondblclick = (e) => {
        const item = e.target.closest('.bw-item');
        if (!item) return;
        const s = Store.students.find(studentId);
        if (!s) return;
        const entries = getMedalWallPetEntries(s);
        const entry = entries[Number(item.dataset.index)];
        if (entry) showStickerHDPreview(entry);
      };
      grid.onkeydown = (e) => {
        const item = e.target.closest('.bw-item');
        if (!item || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        item.click();
      };
    }
    if (pngBtn) pngBtn.onclick = () => runStickerWallPngExport(studentId);
    if (document.getElementById('bw-btn-cert')) {
      document.getElementById('bw-btn-cert').onclick = () => {
        const s = Store.students.find(studentId);
        if (!s) return;
        const sel = document.querySelector('#bw-sticker-grid .bw-item.is-selected');
        if (!sel) { UI.toast('请先点击选择一张贴纸', 'warning'); return; }
        const entries = getMedalWallPetEntries(s);
        const entry = entries[Number(sel.dataset.index)];
        if (entry) showCertificateModal(studentId, entry);
      };
    }
    if (listBtn) {
      listBtn.onclick = () => {
        const s = Store.students.find(studentId);
        if (s) exportStickerWallList(s);
      };
    }
    const deleteBtn = document.getElementById('bw-btn-delete');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        const s = Store.students.find(studentId);
        if (!s) return;
        const sel = document.querySelector('#bw-sticker-grid .bw-item.is-selected');
        if (!sel) { UI.toast('请先点击选择一张贴纸进行删除', 'warning'); return; }
        const entries = getMedalWallPetEntries(s);
        const idx = Number(sel.dataset.index);
        const entry = entries[idx];
        if (!entry) return;
        const name = entry.petName || (getPet(entry.petType)||{}). name || '贴纸';
        UI.confirm(`确定要删除 ${s.name} 的「${name}」徽章吗？删除后将无法恢复！`, () => {
          if (entry._from === 'collect') {
            const petStickers = (s.petStickers || []).filter((e, i) => {
              // 这里的策略：如果是 collect 来源，过滤掉内容完全一致的那一项
              return !(e.petType === entry.petType && e.date === entry.date && (e.petName || '') === (entry.petName || ''));
            });
            Store.students.update(studentId, { petStickers });
          } else {
            const fullLevelPets = (s.fullLevelPets || []).filter((e, i) => {
              return !(e.petType === entry.petType && e.date === entry.date);
            });
            Store.students.update(studentId, { fullLevelPets });
          }
          Store.forceSync();
          UI.toast('徽章已从徽章墙中移除', 'success');
          renderStickerBadgeWallModal(Store.students.find(studentId));
        }, '确认删除');
      };
    }
  }

  /* ── 证书导出 ── */
  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function showCertificateModal(studentId, petEntry = null) {
    const s = Store.students.find(studentId);
    if (!s) return;
    const cls = Store.classes.find(currentClassId);
    const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    if (!petEntry) {
      const wall = getMedalWallPetEntries(s);
      if (wall.length > 0) petEntry = wall[0];
      else {
        const li = calcLevelInfo(s.fedLegs || 0, Store.levels.get(currentClassId));
        const maxDef = getMaxLevel(Store.levels.get(currentClassId));
        if (li.level >= maxDef.level) {
          petEntry = { petType: s.petType, petName: getPet(s.petType).name, imgPath: getPetImg(s.petType, li.stage) };
        }
      }
    }

    if (!petEntry) {
      UI.toast('该学生暂无满级萌宠，无法生成奖状', 'info');
      return;
    }

    // .modal-box.wide is 680px max on desktop
    const modalWidth = Math.min(window.innerWidth - 40, 680);
    const scale = Math.min(1, modalWidth / 900); // 900 is approx needed width with padding
    const wrapperMargin = -580 * (1 - scale); // offset height difference

    const html = `
    <div class="cert-modal-body" style="overflow-x: hidden; overflow-y: auto; max-height: 85vh;">
      <div style="transform: scale(${scale}); transform-origin: top center; margin-bottom: ${wrapperMargin}px;">
        <div id="certificate-capture" class="cert-container">
          <div class="cert-inner">
          <div class="cert-header">
            <div class="cert-header-badge">荣誉证书</div>
            <h1 class="cert-title-big">奖状</h1>
          </div>
          
          <div class="cert-body-area">
            <div class="cert-greeting">${s.name} 同学！谢谢你！</div>
            <div class="cert-body-p">
              在你的用心陪伴下，我从一颗小小的宠物蛋一点一点地长大了！谢谢你每天给我加油打气、悉心照顾，是你让我们的班级变得更加强大和快乐。
            </div>
            <div class="cert-highlight-msg">你真是最棒的小主人！✨</div>
            <div class="cert-promise">*要常回来看我哦，我会一直等着你 🌈</div>
          </div>
          
          <!-- 左下方信息区 -->
          <div class="cert-footer-info">
            <div class="cert-footer-item">班级：${cls ? cls.name : '—'}</div>
            <div class="cert-footer-item">日期：${date}</div>
            <div class="cert-footer-item">优秀学生：${s.name}</div>
            <div class="cert-footer-item">老师签名：________________</div>
          </div>
          
          <!-- 右下方宠物勋章 -->
          <div class="cert-footer-medal-wrap">
            <div class="cert-wreath-medal">
              <div class="cert-wreath-inner">
                <img data-pet-img="${petEntry.imgPath}" class="cert-pet-img-fixed" alt="" style="opacity: 0;">
              </div>
              <div class="cert-medal-ribbon"></div>
            </div>
          </div>
          
          <div class="cert-stamp-modern">💮</div>
        </div>
      </div>
      </div>
      <div class="cert-export-btn-wrap">
        <button class="btn-primary" id="do-export-cert-btn">📥 下载 PNG 奖状</button>
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
      </div>
    </div>`;

    UI.openModal('📜 萌宠养成奖状', html, { wide: true });

    // 立即通过代理加载图片到模态框预览（使用缓存）
    const previewImg = document.querySelector('.cert-pet-img-fixed');
    if (previewImg && petEntry.imgPath) {
      console.log('[奖状] 开始加载宠物图片:', petEntry.imgPath);
      
      // 尝试直接加载（如果是本地路径）
      const tryDirectLoad = () => {
        previewImg.onload = () => {
          console.log('[奖状] 图片直接加载成功');
          previewImg.style.opacity = '1';
        };
        previewImg.onerror = () => {
          console.warn('[奖状] 图片直接加载失败，尝试代理加载');
          // 如果直接加载失败，尝试通过代理加载
          loadImageViaProxy(petEntry.imgPath).then(base64Data => {
            if (base64Data) {
              console.log('[奖状] 代理加载成功');
              previewImg.onload = () => {
                previewImg.style.opacity = '1';
              };
              previewImg.onerror = null; // 清除错误处理
              previewImg.src = base64Data;
            } else {
              console.error('[奖状] 代理加载失败，使用默认显示');
              previewImg.style.opacity = '1'; // 即使失败也显示，避免空白
            }
          });
        };
        previewImg.src = petEntry.imgPath;
      };
      
      tryDirectLoad();
    }

    document.getElementById('do-export-cert-btn').onclick = async () => {
      const btn = document.getElementById('do-export-cert-btn');
      btn.disabled = true;
      btn.textContent = '正在生成...';
      try {
        await loadHtml2Canvas();
        
        const originalEl = document.getElementById('certificate-capture');
        const cloneEl = originalEl.cloneNode(true);
        cloneEl.style.position = 'fixed';
        cloneEl.style.left = '-9999px';
        cloneEl.style.top = '0';
        cloneEl.style.transform = 'none';
        cloneEl.style.margin = '0';
        document.body.appendChild(cloneEl);

        // 确保克隆的图片也有 src（重新通过代理加载）
        const imgInClone = cloneEl.querySelector('img');
        if (imgInClone && petEntry.imgPath) {
          console.log('[奖状导出] 加载图片:', petEntry.imgPath);
          
          // 尝试多种加载方式
          let imageLoaded = false;
          
          // 方式1: 尝试直接使用路径
          try {
            imgInClone.src = petEntry.imgPath;
            imgInClone.style.opacity = '1';
            await new Promise((resolve) => {
              if (imgInClone.complete && imgInClone.naturalWidth > 0) {
                console.log('[奖状导出] 直接加载成功');
                imageLoaded = true;
                resolve();
              } else {
                imgInClone.onload = () => {
                  console.log('[奖状导出] 直接加载成功');
                  imageLoaded = true;
                  resolve();
                };
                imgInClone.onerror = () => resolve();
                setTimeout(resolve, 1000); // 1秒超时
              }
            });
          } catch (e) {
            console.warn('[奖状导出] 直接加载失败:', e);
          }
          
          // 方式2: 如果直接加载失败，尝试代理加载
          if (!imageLoaded) {
            console.log('[奖状导出] 尝试代理加载');
            const base64Data = await loadImageViaProxy(petEntry.imgPath);
            if (base64Data) {
              imgInClone.src = base64Data;
              imgInClone.style.opacity = '1';
              // 等待图片加载
              await new Promise((resolve) => {
                if (imgInClone.complete) {
                  console.log('[奖状导出] 代理加载成功');
                  resolve();
                } else {
                  imgInClone.onload = () => {
                    console.log('[奖状导出] 代理加载成功');
                    resolve();
                  };
                  imgInClone.onerror = () => {
                    console.error('[奖状导出] 代理加载失败');
                    resolve();
                  };
                  setTimeout(resolve, 1000);
                }
              });
            }
          }
        }

        const canvas = await html2canvas(cloneEl, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#fffaf2'
        });

        document.body.removeChild(cloneEl);

        const link = document.createElement('a');
        link.download = `奖状_${s.name}_${petEntry.petName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        UI.toast('奖状已开始下载', 'success');
      } catch (err) {
        console.error(err);
        UI.toast('导出失败，请重试', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '📥 下载 PNG 奖状';
      }
    };
  }

  function showMedalWall(id) {
    const s = Store.students.find(id);
    if (!s) return;
    renderStickerBadgeWallModal(s);
  }

  function renderStickerBadgeWallModal(s) {
    const html = `<div class="medal-modal-body bw-modal--stickers-only">${buildStickerWallSection(s, { inlineClose: true })}</div>`;
    UI.openModal(`🏅 ${s.name} 的徽章墙`, html, { wide: true, noAutofocus: true });
    bindStickerWallInteractions(s.id);
  }

  /* ── Badges ── */
  function showBadges(id) {
    const s = Store.students.find(id);
    if (!s) return;
    renderBadgesModal(s);
  }

  function renderBadgesModal(s) {
    const badges = s.badges || [];
    const html = `
      <div class="badges-grid" id="badges-grid">
        ${badges.map((b, i) => `<span class="badge-chip">${b}
          <span class="remove-badge" data-idx="${i}">✕</span>
        </span>`).join('') || '<span style="color:var(--text-muted);font-size:.875rem">暂无徽章</span>'}
      </div>
      <div class="add-badge-form">
        <input type="text" id="badge-input" placeholder="输入徽章名称，如：数学达人" style="flex:1">
        <button class="btn-primary btn-sm" id="add-badge-btn">添加</button>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`;
    UI.openModal(`🎖️ ${s.name} 的宠物徽章`, html);
    document.getElementById('add-badge-btn').onclick = () => {
      const val = document.getElementById('badge-input').value.trim();
      if (!val) return;
      const badges = [...(Store.students.find(s.id).badges || []), val];
      Store.students.update(s.id, { badges });
      document.getElementById('badge-input').value = '';
      rerenderBadgesGrid(s.id);
    };
    bindBadgeRemoves(s.id);
  }

  function rerenderBadgesGrid(sid) {
    const s = Store.students.find(sid);
    const grid = document.getElementById('badges-grid');
    if (!grid) return;
    const badges = s.badges || [];
    grid.innerHTML = badges.map((b, i) => `<span class="badge-chip">${b}
      <span class="remove-badge" data-idx="${i}">✕</span>
    </span>`).join('') || '<span style="color:var(--text-muted);font-size:.875rem">暂无徽章</span>';
    bindBadgeRemoves(sid);
  }

  function bindBadgeRemoves(sid) {
    document.querySelectorAll('.remove-badge').forEach(btn => {
      btn.onclick = () => {
        const s = Store.students.find(sid);
        const badges = (s.badges || []).filter((_, i) => i !== Number(btn.dataset.idx));
        Store.students.update(sid, { badges });
        rerenderBadgesGrid(sid);
      };
    });
  }

  /* ── 宠物背景库 ── */
  // minLevel: 解锁所需等级，不填默认5级
  const PET_BG_LIST = [
    { id: 'default', label: '默认',  src: '',                    minLevel: 5 },
    { id: 'bg1',  label: '背景1',   src: './宠物背景.jpg',       minLevel: 5 },
    { id: 'bg2',  label: '背景2',   src: './宠物背景2.jpg',      minLevel: 5 },
    { id: 'bg3',  label: '背景3',   src: './宠物背景3.jpg',      minLevel: 5 },
    { id: 'bg4',  label: '背景4',   src: './宠物背景4.jpg',      minLevel: 5 },
    { id: 'bg5',  label: '背景5',   src: './宠物背景5.jpg',      minLevel: 5 },
    { id: 'bg6',  label: '背景6',   src: './宠物背景6.jpg',      minLevel: 5 },
    { id: 'bg7',  label: '背景7',   src: './宠物背景7.jpg',      minLevel: 5 },
    { id: 'bg8',  label: '背景8',   src: './宠物背景8.jpg',      minLevel: 5 },
    { id: 'bg9',  label: '背景9',   src: './宠物背景9.jpg',      minLevel: 5 },
    { id: 'bg10', label: '背景10',  src: './宠物背景10.jpg',    minLevel: 8 },
    { id: 'bg11', label: '背景11',  src: './宠物背景11.jpg',    minLevel: 8 },
    { id: 'bg12', label: '背景12',  src: './宠物背景12.jpg',    minLevel: 8 },
    { id: 'bg13', label: '背景13',  src: './宠物背景13.jpg',    minLevel: 8 },
    { id: 'bg14', label: '背景14',  src: './宠物背景14.jpg',    minLevel: 8 },
    { id: 'bg15', label: '背景15',  src: './宠物背景15.jpg',    minLevel: 8 },
    { id: 'bg16', label: '背景16',  src: './宠物背景16.jpg',    minLevel: 8 },
    { id: 'bg17', label: '背景17',  src: './宠物背景17.jpg',    minLevel: 8 },
    { id: 'bg18', label: '背景18',  src: './宠物背景18.jpg',    minLevel: 8 },
    { id: 'bg19', label: '背景19',  src: './宠物背景19.jpg',    minLevel: 8 },
    { id: 'bg20', label: '背景20',  src: './宠物背景20.jpg',    minLevel: 8 },
    { id: 'bg21', label: '背景21',  src: './宠物背景21.jpg',    minLevel: 8 },
    { id: 'bg22', label: '背景22',  src: './宠物背景22.jpg',    minLevel: 8 },
    { id: 'bg23', label: '背景23',  src: './宠物背景23.jpg',    minLevel: 8 },
    { id: 'bg24', label: '背景24',  src: './宠物背景24.jpg',    minLevel: 8 },
    { id: 'bg25', label: '背景25',  src: './宠物背景25.jpg',    minLevel: 8 },
  ];

  function showChangePetBg(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const levelCfg = Store.levels.get(currentClassId);
    const li = s.petType ? calcLevelInfo(s.fedLegs || 0, levelCfg) : { level: 0 };
    if (li.level < 5) {
      UI.toast('满5级后才能切换宠物背景', 'warning');
      return;
    }
    let selectedBg = s.petBg || '';
    const itemsHtml = PET_BG_LIST.map(bg => {
      const isSel = selectedBg === bg.src;
      const locked = li.level < (bg.minLevel || 5);
      return `<button type="button" class="petbg-item${isSel ? ' petbg-item--active' : ''}${locked ? ' petbg-item--locked' : ''}" data-bg="${bg.src}" title="${locked ? `🔒 满${bg.minLevel}级解锁` : bg.label}" ${locked ? 'disabled' : ''}>
        ${locked
          ? `<div class="petbg-thumb petbg-thumb--locked"><span class="petbg-lock-icon">🔒</span>${bg.src ? `<img src="${bg.src}" alt="" class="petbg-thumb-blur">` : ''}</div>`
          : bg.src
            ? `<img src="${bg.src}" alt="${bg.label}" class="petbg-thumb">`
            : `<div class="petbg-thumb petbg-thumb--default">无背景</div>`}
        <div class="petbg-label">${locked ? `🔒 满${bg.minLevel}级` : bg.label + (isSel ? ' ✓' : '')}</div>
      </button>`;
    }).join('');
    UI.openModal(`🖼️ 切换宠物背景 — ${s.name}`,
      `<div class="petbg-grid">${itemsHtml}</div>
      <div class="modal-footer">
        <button class="btn-primary" id="petbg-batch-btn">一键更换背景</button>
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`,
      { narrow: true }
    );
    // 点击背景项：高亮 + 保存当前学生（不关闭弹窗）
    document.querySelectorAll('#modal-body .petbg-item').forEach(btn => {
      btn.onclick = () => {
        selectedBg = btn.dataset.bg;
        Store.students.update(id, { petBg: selectedBg });
        renderCard(id);
        document.querySelectorAll('#modal-body .petbg-item').forEach(b => {
          const active = b.dataset.bg === selectedBg;
          b.classList.toggle('petbg-item--active', active);
          b.querySelector('.petbg-label').textContent =
            PET_BG_LIST.find(x => x.src === b.dataset.bg)?.label + (active ? ' ✓' : '');
        });
      };
    });
    // 一键更换背景：应用给所有满5级同学
    document.getElementById('petbg-batch-btn').onclick = () => {
      const allStudents = Store.students.byClass(currentClassId);
      let count = 0;
      allStudents.forEach(st => {
        if (!st.petType) return;
        const stLi = calcLevelInfo(st.fedLegs || 0, levelCfg);
        if (stLi.level >= 5) {
          Store.students.update(st.id, { petBg: selectedBg });
          renderCard(st.id);
          count++;
        }
      });
      UI.closeModal();
      UI.toast(`已为 ${count} 位满5级同学更换背景`, 'success');
    };
  }

  /* ── Change Pet ── */
  function showChangePet(id) {
    const s = Store.students.find(id);
    if (!s) return;
    const hadPet = !!s.petType;
    UI.openModal(`🐾 ${hadPet ? '更换' : '领养'}萌宠 — ${s.name}`, `
      <div id="pet-selector" class="pet-selector-grid"></div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
        <button class="btn-primary" id="save-pet-btn">${hadPet ? '确认更换' : '确认领养'}</button>
      </div>`, { wide: true });
    UI.renderPetSelector(s.petType, 'pet-selector');
    document.getElementById('save-pet-btn').onclick = () => {
      const pt = UI.getSelectedPet('pet-selector');
      if (!pt) { UI.toast('请选择宠物', 'warning'); return; }
      if (!hadPet) {
        Store.students.adoptPet(id, pt);
      } else {
        Store.students.update(id, { petType: pt, lastPetFedAt: new Date().toISOString() });
      }
      UI.closeModal();
      UI.toast(`${s.name} 已${hadPet ? '更换' : '领养'}为 ${getPet(pt).name}`, 'success');
      renderCard(id);
    };
  }

  /* ── Delete ── */
  function deleteStudent(id) {
    const s = Store.students.find(id);
    if (!s) return;
    UI.confirm(`确定要删除学生「${s.name}」吗？`, () => {
      Store.students.remove(id);
      Store.records.removeByStudent(id);
      UI.toast(`${s.name} 已删除`, 'success');
      renderCard(id);
      if (document.getElementById('tab-records').classList.contains('active')) {
        Records.render(currentClassId);
      }
    }, '删除学生');
  }

  /* ── Batch ops ── */
  function toggleSelect(id, card) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
      card.classList.remove('selected');
      const icon = card.querySelector('.card-check-icon');
      if (icon) icon.textContent = '';
    } else {
      selectedIds.add(id);
      card.classList.add('selected');
      const icon = card.querySelector('.card-check-icon');
      if (icon) icon.textContent = '✓';
    }
    updateBatchBar();
  }

  function toggleEditMode() {
    isSelectMode = !isSelectMode;
    if (!isSelectMode) _clearSelection();
    document.getElementById('batch-bar').classList.toggle('active', isSelectMode);
    document.getElementById('students-grid').classList.toggle('select-mode', isSelectMode);
    updateBatchBar();
  }

  function exitEditMode() {
    isSelectMode = false;
    _clearSelection();
    document.getElementById('batch-bar').classList.remove('active');
    document.getElementById('students-grid').classList.remove('select-mode');
    updateBatchBar();
  }

  function _clearSelection() {
    selectedIds.clear();
    document.querySelectorAll('.student-card.selected').forEach(c => {
      c.classList.remove('selected');
      const icon = c.querySelector('.card-check-icon');
      if (icon) icon.textContent = '';
    });
  }

  function toggleSelectAll() {
    const grid = document.getElementById('students-grid');
    const cards = Array.from(grid.querySelectorAll('.student-card'));
    const allSelected = cards.every(c => selectedIds.has(c.dataset.id));
    if (allSelected) {
      // 全部已选 → 取消全选
      selectedIds.clear();
      cards.forEach(c => c.classList.remove('selected'));
      cards.forEach(c => { const icon = c.querySelector('.card-check-icon'); if (icon) icon.textContent = ''; });
    } else {
      // 否则 → 全选
      cards.forEach(c => {
        selectedIds.add(c.dataset.id);
        c.classList.add('selected');
        const icon = c.querySelector('.card-check-icon');
        if (icon) icon.textContent = '✓';
      });
    }
    const btn = document.getElementById('btn-select-all');
    if (btn) btn.textContent = selectedIds.size > 0 && cards.every(c => selectedIds.has(c.dataset.id)) ? '✖ 取消全选' : '☑ 全选';
    updateBatchBar();
  }

  function updateBatchBar() {
    const cnt = document.getElementById('batch-count');
    const hasSel = selectedIds.size > 0;
    const total = document.querySelectorAll('#students-grid .student-card').length;
    const allSel = total > 0 && selectedIds.size === total;

    // 触发按钮文字（位于 header）
    const toggleBtn = document.getElementById('nav-batch-btn');
    if (toggleBtn) toggleBtn.textContent = isSelectMode ? '✖ 批量加减分中' : '批量加减分';

    // 全选按钮
    const selAllBtn = document.getElementById('btn-select-all');
    if (selAllBtn) {
      selAllBtn.textContent = allSel ? '✖ 取消全选' : '☑ 全选';
      selAllBtn.classList.toggle('all-selected', allSel);
    }

    // 计数文字
    if (cnt) {
      cnt.textContent = hasSel ? `已选 ${selectedIds.size} 人` : '请点选学生';
      cnt.classList.toggle('has-selection', hasSel);
    }

    // 操作按钮：有选中才启用
    ['batch-add-score', 'batch-deduct-score']
      .forEach(id => { const el = document.getElementById(id); if (el) el.disabled = !hasSel; });
  }

  function batchScoreModal(mode) {
    if (selectedIds.size === 0) { UI.toast('请先选择学生', 'warning'); return; }

    const cfg = Store.scoreItems.get(currentClassId);
    const addItems = cfg.add || SCORE_ADD_ITEMS;
    const deductItems = cfg.deduct || SCORE_DEDUCT_ITEMS;
    const title = mode === 'add' ? `批量加分（已选 ${selectedIds.size} 人）` : `批量扣分（已选 ${selectedIds.size} 人）`;
    const searchId = 'batch-score-item-search';
    const addId = 'batch-score-add-grid';
    const deductId = 'batch-score-deduct-grid';

    const addCardsHtml = (list) => list.map(it => `
      <button type="button" class="si-card si-add" data-value="${it.value}" data-reason="${it.name}">
        <i class="si-icon ri ${it.icon}" aria-hidden="true"></i>
        <span class="si-name">${it.name}</span>
        <span class="si-val si-val-add">+${it.value} 🍗</span>
      </button>`).join('');
    const deductCardsHtml = (list) => list.map(it => `
      <button type="button" class="si-card si-deduct" data-value="${it.value}" data-deduct="1" data-reason="${it.name}">
        <i class="si-icon ri ${it.icon}" aria-hidden="true"></i>
        <span class="si-name">${it.name}</span>
        <span class="si-val si-val-deduct">-${it.value} 🍗</span>
      </button>`).join('');

    const body = `
      <label class="si-search-wrap">
        <i class="ri ri-search-line si-search-icon" aria-hidden="true"></i>
        <input type="text" id="${searchId}" class="si-search-input" placeholder="搜索项目 (支持首字母如 cd 搜 迟到)">
      </label>
      <div class="si-section" ${mode === 'deduct' ? 'style="display:none"' : ''}>
        <div class="si-section-title"><i class="ri ri-add-line"></i> 加分项</div>
        <div id="${addId}" class="si-grid">${addCardsHtml(addItems)}</div>
      </div>
      <div class="si-section" ${mode === 'add' ? 'style="display:none"' : ''}>
        <div class="si-section-title"><i class="ri ri-subtract-line"></i> 扣分项</div>
        <div id="${deductId}" class="si-grid">${deductCardsHtml(deductItems)}</div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
      </div>`;

    UI.openModal(title, body, { wide: true, noAutofocus: true });

    function filterItems(q) {
      const kw = (q || '').toLowerCase().trim();
      const match = (it) => !kw || it.name.includes(kw) || (it.py && it.py.includes(kw));
      const addList = addItems.filter(match);
      const deductList = deductItems.filter(match);
      if (document.getElementById(addId)) document.getElementById(addId).innerHTML = addCardsHtml(addList);
      if (document.getElementById(deductId)) document.getElementById(deductId).innerHTML = deductCardsHtml(deductList);
      bindItemClicks();
    }

    function bindItemClicks() {
      [addId, deductId].forEach(gid => {
        const grid = document.getElementById(gid);
        if (!grid) return;
        grid.querySelectorAll('.si-card').forEach(btn => {
          btn.onclick = () => {
            const rawVal = Math.abs(Number(btn.dataset.value) || 0);
            const isDeduct = btn.classList.contains('si-deduct') || !!btn.dataset.deduct;
            const val = isDeduct ? -rawVal : rawVal;
            const reason = (btn.dataset.reason || '批量操作').trim();
            if (rawVal === 0) return;

            const ids = [...selectedIds];
            const targetIds = ids.filter(id => (Store.students.find(id)||{}).petType);
            const skipped = ids.length - targetIds.length;

            if (targetIds.length === 0) {
              UI.toast('选中的学生均未领养萌宠，无法加分或扣分', 'warning');
              return;
            }

            UI.closeModal();
            exitEditMode();

            // Defer heavy processing to next tick to allow modal to close immediately
            setTimeout(() => {
              if (val > 0) {
                Store.students.batchAddScoreAndFeed(targetIds, val, reason, `加分自动投喂 (${reason})`);
              } else {
                Store.students.batchAddScoreAndFeed(targetIds, val, reason, null);
              }

              if (typeof Effects !== 'undefined') {
                if (val > 0 && Effects.playScoreRewardSound) Effects.playScoreRewardSound();
                else if (val < 0 && Effects.playScorePenaltySound) Effects.playScorePenaltySound();
              }

              if (val > 0) {
                UI.toast(`已为 ${targetIds.length} 名学生 +${val} 🍗${skipped > 0 ? `（跳过 ${skipped} 名未领养学生）` : ''}`, 'success');
              } else {
                UI.toast(`已为 ${targetIds.length} 名学生扣除 ${Math.abs(val)} 🍗${skipped > 0 ? `（跳过 ${skipped} 名未领养学生）` : ''}`, 'warning');
              }

              // Use partial rendering if only a few students are updated, otherwise full render is safer
              if (targetIds.length <= 15) {
                targetIds.forEach(id => renderCard(id));
              } else {
                render();
              }

              if (document.getElementById('tab-records').classList.contains('active')) {
                Records.render(currentClassId);
              }
            }, 50);
          };
        });
      });
    }

    document.getElementById(searchId).oninput = function () { filterItems(this.value); };
    bindItemClicks();
  }

  return {
    init, render, renderCard, showAddModal, showBatchAdd, closeDropdown, setSearchFilter, setGroupFilter, getGroupFilter,
    toggleEditMode, getSortMode, setSortMode,
    showRedeemForStudent, showRedeemRecords,
    showAttendanceModal, showAttendanceHistory,
    toggleSeatEditMode, isSeatEditMode,
    openDensityAdjuster,
  };
})();