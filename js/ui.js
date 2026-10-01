/* ═══════════════════════ UI.JS ═══════════════════════
   Toast, Modal, Confirm, helpers
═══════════════════════════════════════════════════════ */

const UI = (() => {

  /* ── Toast ── */
  function toast(msg, type = 'info', duration = 2800) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  /* ── Modal ── */
  const overlay = () => document.getElementById('modal-overlay');
  const box = () => document.getElementById('modal-box');

  function openModal(title, bodyHtml, opts = {}) {
    document.getElementById('modal-title').textContent = title;
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    
    // 清除旧内容
    body.innerHTML = bodyHtml;
    footer.innerHTML = '';
    footer.style.display = 'none';

    // 自动寻找并提取内容中的 modal-footer（兼容旧代码）
    const footerInBody = body.querySelector('.modal-footer');
    if (footerInBody) {
      box().classList.add('has-footer');
      footer.style.display = 'flex';
      footer.className = footerInBody.className;
      footer.style.cssText = footerInBody.style.cssText;
      footer.style.display = 'flex'; // 强制 flex
      footer.innerHTML = footerInBody.innerHTML;
      footerInBody.remove();
    } else {
      box().classList.remove('has-footer');
    }

    if (opts.wide) box().classList.add('wide');
    else box().classList.remove('wide');
    if (opts.narrow) box().classList.add('narrow');
    else box().classList.remove('narrow');
    overlay().classList.add('open');

    // 默认聚焦首个表单控件
    if (!opts.noAutofocus) {
      setTimeout(() => {
        const first = body.querySelector('input, select, textarea');
        if (first) first.focus();
      }, 100);
    }
  }

  function closeModal() {
    overlay().classList.remove('open');
    if (box()) {
      box().classList.remove('wide', 'narrow', 'has-footer');
    }
    // 清理 header 里由子功能动态插入的元素（如加减分弹窗的自定义按钮）
    document.querySelectorAll('#modal-box .modal-header .si-header-actions').forEach(el => el.remove());
    // 清理以防下次干扰
    const footer = document.getElementById('modal-footer');
    if (footer) {
      footer.innerHTML = '';
      footer.className = 'modal-footer';
      footer.style.cssText = '';
      footer.style.display = 'none';
    }
  }

  /* ── Confirm ── */
  function confirm(msg, onYes, title = '确认操作') {
    const html = `
      <p style="margin-bottom:1.5rem;color:var(--text)">${msg}</p>
      <div class="modal-footer" style="margin-top:0;padding-top:0;border:none">
        <button class="btn-ghost" id="confirm-no">取消</button>
        <button class="btn-danger btn-sm" id="confirm-yes">确认</button>
      </div>`;
    openModal(title, html, { narrow: true });
    document.getElementById('confirm-yes').onclick = () => { closeModal(); onYes(); };
    document.getElementById('confirm-no').onclick = closeModal;
  }

  /* ── Pet image with fallback ── */
  function petImgHtml(type, stage, cls = '') {
    const src = getPetImg(type, stage);
    const pet = getPet(type);
    return `<img src="${src}" alt="${pet.name}" class="${cls}"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
    ><span style="display:none;font-size:2rem;align-items:center;justify-content:center">${pet.emoji}</span>`;
  }

  /* ── Pet selector grid ── */

  /** 返回宠物选择器 HTML 字符串（不操作 DOM），可内联到表单 HTML 里一次性渲染 */
  function petSelectorHtml(selectedType) {
    return PET_TYPES.map(p => {
      const sel = p.type === selectedType ? 'selected' : '';
      return `<div class="pet-selector-item ${sel}" data-type="${p.type}" title="${p.name}">
        <img src="${getPetImg(p.type, 1)}" alt="${p.name}" class="pet-selector-img"
          onerror="this.style.display='none';this.parentNode.style.fontSize='1.8rem';this.parentNode.textContent='${p.emoji}'">
        <div class="pet-selector-name">${p.name}</div>
      </div>`;
    }).join('');
  }

  /** 绑定宠物选择器点击事件（在 openModal 之后调用） */
  function bindPetSelector(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('.pet-selector-item').forEach(el => {
      el.addEventListener('click', () => {
        c.querySelectorAll('.pet-selector-item').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  }

  /** 兼容旧调用：设置 innerHTML + 绑定事件 */
  function renderPetSelector(selectedType, containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = petSelectorHtml(selectedType);
    bindPetSelector(containerId);
  }

  function getSelectedPet(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return null;
    const sel = c.querySelector('.pet-selector-item.selected');
    return sel ? sel.dataset.type : null;
  }

  /* ── Score input modal body ── */
  function scoreInputBody(mode = 'add') {
    const isAdd = mode === 'add';
    const qVals = isAdd ? [1,2,3,5,10] : [-1,-2,-3,-5,-10];
    const qClass = isAdd ? 'add-q' : 'deduct-q';
    return `
      <div class="score-quick-btns">
        ${qVals.map(v => `<button class="score-quick-btn ${qClass}" data-val="${v}">${isAdd ? '+' : ''}${v}</button>`).join('')}
      </div>
      <div class="modal-form">
        <div class="form-field">
          <label>分值</label>
          <input type="number" id="score-val" value="${isAdd ? 1 : -1}" min="${isAdd ? 1 : -999}" max="${isAdd ? 9999 : -1}">
        </div>
        <div class="form-field">
          <label>原因</label>
          <select id="score-reason">
            ${SCORE_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
            <option value="__custom__">自定义…</option>
          </select>
        </div>
        <div class="form-field hidden" id="score-reason-custom-wrap">
          <label>自定义原因</label>
          <input type="text" id="score-reason-custom" placeholder="请输入原因">
        </div>
      </div>`;
  }

  /* ── Populate filter dropdowns ── */
  function populatePetFilter(students) {
    const sel = document.getElementById('filter-pet');
    if (!sel) return;
    const types = [...new Set(students.map(s => s.petType))];
    sel.innerHTML = '<option value="">全部宠物</option>' +
      types.map(t => {
        const p = getPet(t);
        return `<option value="${t}">${p.emoji} ${p.name}</option>`;
      }).join('');
  }

  function populateGroupFilter(groups) {
    const sel = document.getElementById('filter-group');
    if (!sel) return;
    sel.innerHTML = '<option value="">全部小组</option>' +
      groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  }

  function populateRecordsStudentFilter(students) {
    const sel = document.getElementById('records-filter-student');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">全部学生</option>' +
      students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  }

  return {
    toast, openModal, closeModal, confirm,
    petImgHtml, petSelectorHtml, bindPetSelector, renderPetSelector, getSelectedPet,
    scoreInputBody, populatePetFilter, populateGroupFilter, populateRecordsStudentFilter,
  };
})();

/* ═══════════════════════ HOMEWORK STATS ═══════════════════════
   作业统计功能：未完成/已完成学生管理，倒计时，任务切换
═══════════════════════════════════════════════════════════ */
const HomeworkStats = (() => {
  let incompleteStudents = [];
  let completedStudents = [];
  let removedStudents = []; // 被移除的学生（不参与本次任务）
  let removeMode = false; // 是否处于移除模式
  let timerInterval = null;
  let timerSeconds = 0;
  let isTimerRunning = false;
  let currentTask = null;
  let tasks = [];
  let showingTaskSelector = false;
  let selectedTaskId = null; // 待确认的任务ID
  let taskStates = {}; // 存储每个任务的学生状态 { taskId: { incomplete: [], completed: [], removed: [] } }

  // 默认任务列表
  const defaultTasks = [
    { id: 'task-1', name: '作业统计', icon: '📊' },
    { id: 'task-2', name: '古诗背诵', icon: '📜' },
    { id: 'task-3', name: '英语单词背诵', icon: '📖' },
  ];

  function init() {
    // 加载任务列表
    tasks = Store.homework.getTasks();
    if (tasks.length === 0) {
      tasks = [...defaultTasks];
      Store.homework.saveTasks(tasks);
    }
    currentTask = tasks[0];
    
    // 加载任务状态
    taskStates = Store.homework.getStates();

    const openBtn = document.getElementById('nav-homework-stats-btn');
    const closeBtn = document.getElementById('hw-close-btn');
    const shuffleBtn = document.getElementById('hw-shuffle-btn');
    const rewardBtn = document.getElementById('hw-reward-btn');
    const startBtn = document.getElementById('hw-timer-start');
    const pauseBtn = document.getElementById('hw-timer-pause');
    const resetBtn = document.getElementById('hw-timer-reset');
    const switchBtn = document.getElementById('hw-task-switch-btn');
    const addTaskBtn = document.getElementById('hw-task-add-btn');
    const removeModeBtn = document.getElementById('hw-remove-mode-btn');
    const resetAllBtn = document.getElementById('hw-reset-all-btn');
    const penaltyBtn = document.getElementById('hw-penalty-btn');

    if (openBtn) openBtn.onclick = open;
    if (closeBtn) closeBtn.onclick = close;
    if (shuffleBtn) shuffleBtn.onclick = shuffleIncomplete;
    if (rewardBtn) rewardBtn.onclick = rewardCompleted;
    if (penaltyBtn) penaltyBtn.onclick = penaltyIncomplete;
    if (startBtn) startBtn.onclick = startTimer;
    if (pauseBtn) pauseBtn.onclick = pauseTimer;
    if (resetBtn) resetBtn.onclick = resetTimer;
    if (switchBtn) switchBtn.onclick = toggleTaskSelector;
    if (addTaskBtn) addTaskBtn.onclick = addNewTask;
    if (removeModeBtn) removeModeBtn.onclick = toggleRemoveMode;
    if (resetAllBtn) resetAllBtn.onclick = resetAllStudents;
  }

  function open() {
    // 使用 sessionStorage 获取当前班级ID
    let classId = '';
    try {
      classId = sessionStorage.getItem('mc_lastClassId') || '';
    } catch (e) {
      console.error('获取班级ID失败:', e);
    }

    if (!classId) {
      UI.toast('请先选择班级', 'warning');
      return;
    }

    const students = Store.students.byClass(classId);
    console.log('=== 打开作业统计弹窗 ===');
    console.log('加载学生数据:', students);
    console.log('班级ID:', classId);
    console.log('学生数量:', students ? students.length : 0);
    
    if (!students || students.length === 0) {
      console.error('警告：未找到学生数据！');
      console.log('Store.students:', Store.students);
      console.log('所有班级学生:', Store.students.getAll());
    }
    
    // 重新加载任务状态（确保获取最新数据）
    taskStates = Store.homework.getStates();
    console.log('重新加载任务状态:', taskStates);
    console.log('当前任务ID:', currentTask.id);
    console.log('当前任务的保存状态:', taskStates[currentTask.id]);
    
    // 加载当前任务的保存状态，如果没有则初始化为全班学生
    if (taskStates[currentTask.id]) {
      const state = taskStates[currentTask.id];
      incompleteStudents = [...state.incomplete];
      completedStudents = [...state.completed];
      removedStudents = [...state.removed];
      console.log('从保存状态加载:', { 
        incomplete: incompleteStudents.length, 
        completed: completedStudents.length, 
        removed: removedStudents.length 
      });
    } else {
      incompleteStudents = [...students];
      completedStudents = [];
      removedStudents = [];
      console.log('初始化为全班学生');
    }
    removeMode = false;
    
    console.log('初始化后 incompleteStudents:', incompleteStudents);
    console.log('初始化后 completedStudents:', completedStudents);
    
    updateTaskTitle();
    render();
    document.getElementById('homework-stats').classList.add('open');
  }

  function close() {
    document.getElementById('homework-stats').classList.remove('open');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // 关闭时隐藏任务选择器
    const selector = document.getElementById('hw-task-selector');
    if (selector) selector.style.display = 'none';
    showingTaskSelector = false;
  }

  function updateTaskTitle() {
    const title = document.getElementById('hw-current-task-title');
    if (title && currentTask) {
      title.textContent = `${currentTask.icon} ${currentTask.name}`;
    }
  }

  function toggleTaskSelector() {
    const selector = document.getElementById('hw-task-selector');
    const switchBtn = document.getElementById('hw-task-switch-btn');
    if (!selector || !switchBtn) return;

    showingTaskSelector = !showingTaskSelector;
    selector.style.display = showingTaskSelector ? 'block' : 'none';

    // 切换按钮文字和功能
    if (showingTaskSelector) {
      switchBtn.textContent = '✓ 确认修改';
      selectedTaskId = currentTask.id; // 初始化为当前任务
      renderTaskList();
    } else {
      // 点击确认修改时，应用选中的任务
      if (selectedTaskId && selectedTaskId !== currentTask.id) {
        applyTaskSwitch(selectedTaskId);
      }
      switchBtn.textContent = '🔄 切换任务';
    }
  }

  function renderTaskList() {
    const list = document.getElementById('hw-task-list');
    if (!list) return;

    list.innerHTML = tasks.map(task => `
      <div class="hw-task-item ${task.id === selectedTaskId ? 'active' : ''}" data-task-id="${task.id}">
        <span class="hw-task-item-name">${task.icon} ${task.name}</span>
        <div class="hw-task-item-actions">
          <button class="hw-task-item-btn rename" title="重命名" data-task-id="${task.id}">✏️</button>
          <button class="hw-task-item-btn delete" title="删除" data-task-id="${task.id}">🗑️</button>
        </div>
      </div>
    `).join('');

    // 绑定任务项点击事件 - 只标记选中，不立即切换
    list.querySelectorAll('.hw-task-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('hw-task-item-btn')) return;
        const taskId = item.dataset.taskId;
        selectTask(taskId);
      });
    });

    // 绑定重命名按钮
    list.querySelectorAll('.hw-task-item-btn.rename').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.taskId;
        renameTask(taskId);
      });
    });

    // 绑定删除按钮
    list.querySelectorAll('.hw-task-item-btn.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.taskId;
        deleteTask(taskId);
      });
    });
  }

  function selectTask(taskId) {
    selectedTaskId = taskId;
    renderTaskList(); // 重新渲染以更新active状态
  }

  function applyTaskSwitch(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    currentTask = task;
    updateTaskTitle();
    
    // 切换任务时，加载该任务的保存状态
    let classId = '';
    try {
      classId = sessionStorage.getItem('mc_lastClassId') || '';
    } catch (e) {
      console.error('获取班级ID失败:', e);
    }
    console.log('applyTaskSwitch - 班级ID:', classId);
    
    if (classId) {
      const allStudents = Store.students.byClass(classId);
      console.log('applyTaskSwitch - 获取学生:', allStudents);
      console.log('applyTaskSwitch - 学生数量:', allStudents ? allStudents.length : 0);
      
      // 加载该任务的保存状态，如果没有则初始化为全班学生
      if (taskStates[taskId]) {
        const state = taskStates[taskId];
        incompleteStudents = [...state.incomplete];
        completedStudents = [...state.completed];
        removedStudents = [...state.removed];
        console.log('applyTaskSwitch - 加载已保存状态');
      } else {
        incompleteStudents = [...allStudents];
        completedStudents = [];
        removedStudents = [];
        console.log('applyTaskSwitch - 初始化新任务状态');
      }
      removeMode = false;
      
      console.log('applyTaskSwitch - 未完成学生:', incompleteStudents.length);
      console.log('applyTaskSwitch - 已完成学生:', completedStudents.length);
      render();
    } else {
      console.error('applyTaskSwitch - 未找到班级ID');
    }
    
    UI.toast(`已切换到：${task.name}`, 'success');
  }

  function switchTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    console.log('switchTask 被调用, taskId:', taskId);
    
    currentTask = task;
    updateTaskTitle();
    toggleTaskSelector();
    
    // 切换任务时加载该任务的保存状态
    let classId = '';
    try {
      classId = sessionStorage.getItem('mc_lastClassId') || '';
    } catch (e) {
      console.error('获取班级ID失败:', e);
    }
    console.log('switchTask - 班级ID:', classId);
    
    if (classId) {
      const allStudents = Store.students.byClass(classId);
      console.log('switchTask - 学生数量:', allStudents ? allStudents.length : 0);
      
      // 加载该任务的保存状态，如果没有则初始化为全班学生
      if (taskStates[taskId]) {
        const state = taskStates[taskId];
        incompleteStudents = [...state.incomplete];
        completedStudents = [...state.completed];
        removedStudents = [...state.removed];
      } else {
        incompleteStudents = [...allStudents];
        completedStudents = [];
        removedStudents = [];
      }
      removeMode = false;
      render();
    }
    
    UI.toast(`已切换到：${task.name}`, 'success');
  }

  function addNewTask() {
    const name = prompt('请输入新任务名称：');
    if (!name || !name.trim()) return;

    const icon = prompt('请输入任务图标（emoji）：', '📝');
    
    const newTask = {
      id: `task-${Date.now()}`,
      name: name.trim(),
      icon: icon || '📝'
    };

    tasks.push(newTask);
    saveTasks();
    renderTaskList();
    UI.toast('任务添加成功', 'success');
  }

  function renameTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newName = prompt('请输入新的任务名称：', task.name);
    if (!newName || !newName.trim()) return;

    const newIcon = prompt('请输入新的任务图标（emoji）：', task.icon);

    task.name = newName.trim();
    task.icon = newIcon || task.icon;

    // 如果重命名的是当前选中的任务，更新selectedTaskId对应的任务
    if (selectedTaskId === taskId) {
      // 保持选中状态
    }

    // 如果重命名的是正在使用的任务，更新标题
    if (currentTask.id === taskId) {
      updateTaskTitle();
    }

    saveTasks();
    renderTaskList();
    UI.toast('任务重命名成功', 'success');
  }

  function deleteTask(taskId) {
    if (tasks.length <= 1) {
      UI.toast('至少保留一个任务', 'warning');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!confirm(`确定删除任务"${task.name}"吗？`)) return;

    tasks = tasks.filter(t => t.id !== taskId);

    // 如果删除的是当前选中的任务，选中第一个任务
    if (selectedTaskId === taskId) {
      selectedTaskId = tasks[0].id;
    }

    // 如果删除的是正在使用的任务，切换到第一个任务
    if (currentTask.id === taskId) {
      currentTask = tasks[0];
      updateTaskTitle();
    }

    saveTasks();
    renderTaskList();
    UI.toast('任务删除成功', 'success');
  }

  function saveTasks() {
    Store.homework.saveTasks(tasks);
  }

  function render() {
    renderSection('hw-incomplete-grid', incompleteStudents, 'incomplete');
    renderSection('hw-completed-grid', completedStudents, 'completed');
    updateCounts();
    
    // 更新移除按钮状态
    const removeModeBtn = document.getElementById('hw-remove-mode-btn');
    if (removeModeBtn) {
      if (removeMode) {
        removeModeBtn.classList.add('active');
        removeModeBtn.textContent = '✓ 完成移除';
      } else {
        removeModeBtn.classList.remove('active');
        removeModeBtn.textContent = '🗑️ 移除学生';
      }
    }
  }

  function renderSection(gridId, students, section) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    console.log(`渲染 ${gridId}:`, students);
    console.log(`学生数组长度:`, students ? students.length : 'undefined');

    if (!students || students.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">暂无学生</div>';
      return;
    }

    grid.innerHTML = students.map(s => {
      const petImg = s.petType ? getPetImg(s.petType, s.petStage || 1) : 'assets/images/pets/default.png';
      const statusBtnText = section === 'incomplete' ? '✓ 已完成' : '↩ 未完成';
      const statusBtnClass = section === 'incomplete' ? 'hw-incomplete' : 'hw-completed';
      const removeBtn = removeMode ? `<button class="hw-student-remove-btn" data-id="${s.id}">×</button>` : '';
      
      return `
        <div class="hw-student-card-wrapper">
          ${removeBtn}
          <div class="hw-student-card ${statusBtnClass}" data-student-id="${s.id}" data-section="${section}">
            <img src="${petImg}" alt="${s.name}" class="hw-student-avatar" onerror="this.src='assets/images/pets/default.png'">
            <div class="hw-student-name">${s.name}</div>
            <button class="hw-student-status-btn" data-id="${s.id}">${statusBtnText}</button>
          </div>
        </div>
      `;
    }).join('');

    // 绑定状态按钮事件
    grid.querySelectorAll('.hw-student-status-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const studentId = btn.dataset.id;
        const cardSection = btn.closest('.hw-student-card').dataset.section;
        moveStudent(studentId, cardSection);
      });
    });
    
    // 绑定移除按钮事件
    grid.querySelectorAll('.hw-student-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const studentId = btn.dataset.id;
        removeStudent(studentId);
      });
    });
  }

  function moveStudent(studentId, fromSection) {
    console.log('=== moveStudent 被调用 ===');
    console.log('studentId:', studentId);
    console.log('fromSection:', fromSection);
    
    if (fromSection === 'incomplete') {
      const index = incompleteStudents.findIndex(s => s.id === studentId);
      console.log('在未完成列表中找到的索引:', index);
      if (index === -1) return;
      
      const student = incompleteStudents.splice(index, 1)[0];
      completedStudents.push(student);
      console.log('移动到已完成:', student.name);
    } else {
      const index = completedStudents.findIndex(s => s.id === studentId);
      console.log('在已完成列表中找到的索引:', index);
      if (index === -1) return;
      
      const student = completedStudents.splice(index, 1)[0];
      incompleteStudents.push(student);
      console.log('移回未完成:', student.name);
    }
    
    console.log('调用 saveTaskState...');
    saveTaskState();
    console.log('调用 render...');
    render();
  }

  function removeStudent(studentId) {
    const index = incompleteStudents.findIndex(s => s.id === studentId);
    if (index === -1) return;
    
    const student = incompleteStudents.splice(index, 1)[0];
    removedStudents.push(student);
    saveTaskState();
    render();
    UI.toast(`已移除 ${student.name}`, 'info');
  }
  
  function saveTaskState() {
    if (!currentTask) return;
    
    console.log('=== 保存任务状态 ===');
    console.log('当前任务ID:', currentTask.id);
    console.log('未完成学生数:', incompleteStudents.length);
    console.log('已完成学生数:', completedStudents.length);
    console.log('已移除学生数:', removedStudents.length);
    
    taskStates[currentTask.id] = {
      incomplete: [...incompleteStudents],
      completed: [...completedStudents],
      removed: [...removedStudents]
    };
    
    console.log('保存的状态对象:', taskStates);
    console.log('调用 Store.homework.saveStates...');
    
    Store.homework.saveStates(taskStates);
    
    // 验证保存后立即读取
    const verified = Store.homework.getStates();
    console.log('验证：保存后立即读取的状态:', verified);
    console.log('验证：当前任务的状态:', verified[currentTask.id]);
  }

  function toggleRemoveMode() {
    removeMode = !removeMode;
    render();
    
    if (removeMode) {
      UI.toast('点击学生卡片可移除不参与本次任务的学生', 'info');
    } else if (removedStudents.length > 0) {
      UI.toast(`已移除 ${removedStudents.length} 名学生`, 'success');
    }
  }

  function restoreRemovedStudents() {
    incompleteStudents.push(...removedStudents);
    removedStudents = [];
    removeMode = false;
    render();
  }
  
  function resetAllStudents() {
    if (!currentTask) return;
    
    // 显示二次确认弹窗
    const confirmed = confirm(`确定要重置「${currentTask.name}」的所有学生状态吗？\n\n此操作将：\n• 所有学生回到"未完成"区域\n• 清空"已完成"和"已移除"记录\n• 此操作无法撤销`);
    
    if (!confirmed) return;
    
    // 获取全班学生
    let classId = '';
    try {
      classId = sessionStorage.getItem('mc_lastClassId') || '';
    } catch (e) {
      console.error('获取班级ID失败:', e);
      UI.toast('获取班级信息失败', 'error');
      return;
    }
    
    if (!classId) {
      UI.toast('未找到班级信息', 'warning');
      return;
    }
    
    const allStudents = Store.students.byClass(classId);
    if (!allStudents || allStudents.length === 0) {
      UI.toast('未找到学生数据', 'warning');
      return;
    }
    
    // 重置为全班学生在未完成区域
    incompleteStudents = [...allStudents];
    completedStudents = [];
    removedStudents = [];
    removeMode = false;
    
    // 保存重置后的状态
    saveTaskState();
    
    render();
    UI.toast('已重置全班学生状态', 'success');
  }

  function updateCounts() {
    const incompleteCount = document.getElementById('hw-incomplete-count');
    const completedCount = document.getElementById('hw-completed-count');
    if (incompleteCount) incompleteCount.textContent = incompleteStudents.length;
    if (completedCount) completedCount.textContent = completedStudents.length;
  }

  function shuffleIncomplete() {
    for (let i = incompleteStudents.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [incompleteStudents[i], incompleteStudents[j]] = [incompleteStudents[j], incompleteStudents[i]];
    }
    renderSection('hw-incomplete-grid', incompleteStudents, 'incomplete');
    UI.toast('已随机排序', 'success');
  }

  function rewardCompleted() {
    if (completedStudents.length === 0) {
      UI.toast('暂无已完成的学生', 'warning');
      return;
    }

    // 创建自定义加分弹窗
    const overlay = document.createElement('div');
    overlay.className = 'si-custom-overlay';
    overlay.innerHTML = `
      <div class="si-custom-card si-custom-card-add">
        <div class="si-custom-card-header">
          <span class="si-custom-card-title">+ 批量加分</span>
          <button type="button" class="si-custom-card-close" title="关闭">✕</button>
        </div>
        <div class="si-custom-card-body">
          <div class="si-custom-field">
            <label>分数</label>
            <input type="number" id="hw-batch-score" min="1" max="999" value="1" placeholder="输入分数" inputmode="numeric">
          </div>
          <div class="si-custom-field">
            <label>原因 <span class="si-custom-optional">(选填)</span></label>
            <input type="text" id="hw-batch-reason" placeholder="完成作业" value="完成作业">
          </div>
        </div>
        <div class="si-custom-card-footer">
          <button type="button" class="si-custom-confirm si-custom-confirm-add" id="hw-batch-confirm">确定</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const closeSub = () => overlay.remove();
    overlay.querySelector('.si-custom-card-close').onclick = closeSub;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSub(); });

    const scoreInput = overlay.querySelector('#hw-batch-score');
    const reasonInput = overlay.querySelector('#hw-batch-reason');
    setTimeout(() => scoreInput.focus(), 50);

    // 确定按钮
    overlay.querySelector('#hw-batch-confirm').onclick = () => {
      const scoreValue = Math.abs(parseInt(scoreInput.value, 10));
      if (!scoreValue || scoreValue < 1) {
        UI.toast('请输入有效的分数（至少 1）', 'warning');
        scoreInput.focus();
        return;
      }
      const reason = (reasonInput.value || '完成作业').trim() || '完成作业';
      
      closeSub();

      completedStudents.forEach(s => {
        Store.students.addScore(s.id, scoreValue, reason, 'add');
      });
      UI.toast(`已为 ${completedStudents.length} 位学生加 ${scoreValue} 分`, 'success');
    };

    // Enter 快速确定
    [scoreInput, reasonInput].forEach(el => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') overlay.querySelector('#hw-batch-confirm').click();
        if (e.key === 'Escape') closeSub();
      });
    });
  }
  
  function penaltyIncomplete() {
    if (incompleteStudents.length === 0) {
      UI.toast('暂无未完成的学生', 'warning');
      return;
    }

    // 创建自定义减分弹窗
    const overlay = document.createElement('div');
    overlay.className = 'si-custom-overlay';
    overlay.innerHTML = `
      <div class="si-custom-card si-custom-card-deduct">
        <div class="si-custom-card-header">
          <span class="si-custom-card-title">- 批量减分</span>
          <button type="button" class="si-custom-card-close" title="关闭">✕</button>
        </div>
        <div class="si-custom-card-body">
          <div class="si-custom-field">
            <label>分数</label>
            <input type="number" id="hw-batch-score" min="1" max="999" value="1" placeholder="输入分数" inputmode="numeric">
          </div>
          <div class="si-custom-field">
            <label>原因 <span class="si-custom-optional">(选填)</span></label>
            <input type="text" id="hw-batch-reason" placeholder="未完成作业" value="未完成作业">
          </div>
        </div>
        <div class="si-custom-card-footer">
          <button type="button" class="si-custom-confirm si-custom-confirm-deduct" id="hw-batch-confirm">确定</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const closeSub = () => overlay.remove();
    overlay.querySelector('.si-custom-card-close').onclick = closeSub;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSub(); });

    const scoreInput = overlay.querySelector('#hw-batch-score');
    const reasonInput = overlay.querySelector('#hw-batch-reason');
    setTimeout(() => scoreInput.focus(), 50);

    // 确定按钮
    overlay.querySelector('#hw-batch-confirm').onclick = () => {
      const scoreValue = Math.abs(parseInt(scoreInput.value, 10));
      if (!scoreValue || scoreValue < 1) {
        UI.toast('请输入有效的分数（至少 1）', 'warning');
        scoreInput.focus();
        return;
      }
      const reason = (reasonInput.value || '未完成作业').trim() || '未完成作业';
      
      closeSub();

      incompleteStudents.forEach(s => {
        Store.students.addScore(s.id, -scoreValue, reason, 'deduct');
      });
      UI.toast(`已为 ${incompleteStudents.length} 位学生减 ${scoreValue} 分`, 'success');
    };

    // Enter 快速确定
    [scoreInput, reasonInput].forEach(el => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') overlay.querySelector('#hw-batch-confirm').click();
        if (e.key === 'Escape') closeSub();
      });
    });
  }

  function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    timerInterval = setInterval(() => {
      timerSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function pauseTimer() {
    if (!isTimerRunning) return;
    isTimerRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    pauseTimer();
    timerSeconds = 0;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const display = document.getElementById('hw-timer-display');
    if (!display) return;
    
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return {
    init,
    open,
    close,
    moveStudent,
  };
})();
