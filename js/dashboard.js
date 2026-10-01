/* DASHBOARD.JS - Class management */
const Dashboard = (() => {
  let currentTeacher = null;
  function init(teacher) {
    currentTeacher = teacher;
    const nameEl = document.getElementById('teacher-name');
    nameEl.textContent = teacher.name + ' 老师';
    document.getElementById('teacher-name').onclick = showEditNameModal;
    document.getElementById('btn-logout').onclick = Auth.logout;
    document.getElementById('btn-create-class').onclick = showCreateClassModal;
    window.addEventListener('pets-data-sync', () => { if (App.currentPage === 'dashboard') render(); });
    render();
  }
  function showEditNameModal() {
    const name = (currentTeacher && currentTeacher.name) || '';
    UI.openModal('修改姓名', '<div class="modal-form"><div class="form-field"><label>教师姓名</label><input type="text" id="edit-teacher-name" placeholder="请输入姓名" maxlength="50"></div><div class="modal-footer"><button class="btn-ghost" onclick="UI.closeModal()">取消</button><button class="btn-primary" id="save-teacher-name-btn">保存</button></div></div>', { narrow: true });
    const input = document.getElementById('edit-teacher-name');
    input.value = name; input.focus();
    document.getElementById('save-teacher-name-btn').onclick = async () => {
      const newName = document.getElementById('edit-teacher-name').value.trim();
      if (!newName) { UI.toast('姓名不能为空', 'warning'); return; }
      const result = await Store.apiChangeName(newName);
      if (!result.ok) { UI.toast(result.msg || '修改失败', 'error'); if (result.msg && result.msg.includes('重新登录')) App.goto('auth'); return; }
      currentTeacher = result.teacher; Store.teachers.upsert(result.teacher); Store.session.set(result.teacher);
      document.getElementById('teacher-name').textContent = result.teacher.name + ' 老师';
      UI.closeModal(); UI.toast('姓名已更新', 'success');
    };
  }
  function render() {
    const classes = Store.classes.byTeacher(currentTeacher.id);
    const grid = document.getElementById('classes-grid');
    if (classes.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text-muted)"><div style="font-size:4rem;margin-bottom:1rem;opacity:.4">🏫</div><p style="font-size:1.1rem">暂无班级，点击「创建班级」开始吧！</p></div>';
      return;
    }
    grid.innerHTML = classes.map(cls => classCardHtml(cls)).join('');
    grid.querySelectorAll('.class-card-enter').forEach(btn => { btn.onclick = e => { e.stopPropagation(); App.enterClass(btn.dataset.id); }; });
    grid.querySelectorAll('.class-card-edit').forEach(btn => { btn.onclick = e => { e.stopPropagation(); showEditClassModal(btn.dataset.id); }; });
    grid.querySelectorAll('.class-card-delete').forEach(btn => { btn.onclick = e => { e.stopPropagation(); deleteClass(btn.dataset.id); }; });
  }
  function getCumulativeScore(s) { return getLeaderboardWelfareScore(s); }
  function classCardHtml(cls) {
    const students = Store.students.byClass(cls.id);
    const count = students.length;
    const avgScore = count ? Math.round(students.reduce((s, t) => s + getCumulativeScore(t), 0) / count) : 0;
    const gradeStr = cls.grade || '未设置年级';
    return '<div class="class-card"><div class="class-card-banner"><div class="class-card-banner-title">' + cls.name + '</div></div><div class="class-card-body"><div class="class-card-grade">🎓 ' + gradeStr + '</div><div class="class-card-stats"><div class="class-card-stat"><div class="stat-val">' + count + '</div><div class="stat-label">学生人数</div></div><div class="class-card-stat"><div class="stat-val">' + avgScore + '</div><div class="stat-label">平均积分</div></div></div><div class="class-card-actions"><button class="btn-primary btn-sm class-card-enter" data-id="' + cls.id + '">进入班级 →</button><button class="btn-ghost btn-sm class-card-edit" data-id="' + cls.id + '">编辑</button><button class="btn-ghost btn-sm class-card-delete" data-id="' + cls.id + '" style="color:var(--danger);border-color:rgba(239,68,68,.3)">删除</button></div></div></div>';
  }
  function showCreateClassModal() {
    UI.openModal('创建班级', classFormHtml(), { narrow: true });
    document.getElementById('save-class-btn').onclick = () => {
      const name = document.getElementById('cls-name').value.trim();
      const grade = document.getElementById('cls-grade').value;
      if (!name) { UI.toast('请输入班级名称', 'warning'); return; }
      Store.classes.create({ teacherId: currentTeacher.id, name, grade });
      UI.closeModal(); UI.toast('班级创建成功', 'success'); render();
    };
  }
  function showEditClassModal(id) {
    const cls = Store.classes.find(id);
    if (!cls) return;
    UI.openModal('编辑班级', classFormHtml(cls), { narrow: true });
    document.getElementById('save-class-btn').onclick = () => {
      const name = document.getElementById('cls-name').value.trim();
      const grade = document.getElementById('cls-grade').value;
      if (!name) { UI.toast('请输入班级名称', 'warning'); return; }
      Store.classes.update(id, { name, grade });
      UI.closeModal(); UI.toast('班级已更新', 'success'); render();
    };
  }
  function classFormHtml(cls) {
    cls = cls || {};
    return '<div class="modal-form"><div class="form-field"><label>班级名称</label><input type="text" id="cls-name" value="' + (cls.name || '') + '" placeholder="例如：三年(2)班"></div><div class="form-field"><label>年级</label><input type="text" id="cls-grade" value="' + (cls.grade || '') + '" placeholder="例如：三年级、初二、高一"></div><div class="modal-footer"><button class="btn-ghost" onclick="UI.closeModal()">取消</button><button class="btn-primary" id="save-class-btn">' + (cls.id ? '保存' : '创建') + '</button></div></div>';
  }
  function deleteClass(id) {
    const cls = Store.classes.find(id);
    if (!cls) return;
    const count = Store.students.byClass(id).length;
    UI.confirm('确定要删除「' + cls.name + '」吗？<br>将同时删除班级内 <b>' + count + '</b> 名学生及所有记录。', () => { Store.deleteClass(id); UI.toast('班级已删除', 'success'); render(); }, '删除班级');
  }
  return { init, render };
})();