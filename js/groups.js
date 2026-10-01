/* ═══════════════════════ GROUPS.JS ═══════════════════════
   Group management - CRUD + student assignment
   ───────────────────────────────────────────────────────── */

const Groups = (() => {

  let currentClassId = null;

  function init(classId) {
    currentClassId = classId;
    document.getElementById('btn-create-group').onclick = () => showCreateModal();
    // Only render if tab is visible
    if (document.getElementById('tab-groups').classList.contains('active')) {
      render();
    }
  }

  function render() {
    const container = document.getElementById('groups-list');
    if (!container) return;
    // Only render if tab is active
    const tab = document.getElementById('tab-groups');
    if (tab && !tab.classList.contains('active')) return;

    const groups = Store.groups.byClass(currentClassId);
    const students = Store.students.byClass(currentClassId);

    if (groups.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:3rem;margin-bottom:.75rem;opacity:.4">👥</div>
        <p>还没有小组，点击「创建小组」按钮添加</p>
      </div>`;
      return;
    }

    container.innerHTML = groups.map(g => {
      const members = students.filter(s => s.groupIds && s.groupIds.includes(g.id));
      return `
      <div class="group-card" style="border-left-color:${g.color}">
        <div class="group-card-header">
          <div class="group-card-name">
            <span class="group-color-dot" style="background:${g.color}"></span>
            ${g.name}
            <span style="font-weight:400;color:var(--text-muted);font-size:.875rem">(${members.length}人)</span>
          </div>
          <div class="group-card-actions">
            <button class="btn-ghost btn-sm" onclick="Groups._addMember('${g.id}')">＋ 添加成员</button>
            <button class="btn-ghost btn-sm" onclick="Groups._edit('${g.id}')">编辑</button>
            <button class="btn-ghost btn-sm" style="color:var(--danger)" onclick="Groups._delete('${g.id}')">删除</button>
          </div>
        </div>
        <div class="group-members">
          ${members.map(s => `
            <span class="group-member-tag">
              ${s.name}
              <span class="remove-from-group" title="移出小组"
                onclick="Groups._removeMember('${s.id}', '${g.id}')">✕</span>
            </span>`).join('')}
          ${members.length === 0 ? '<span style="color:var(--text-muted);font-size:.85rem">暂无成员</span>' : ''}
        </div>
      </div>`;
    }).join('');
  }

  function showCreateModal(data) {
    UI.openModal(data ? '编辑小组' : '创建小组', groupFormHtml(data), { narrow: true });
    document.getElementById('save-group-btn').onclick = () => saveGroup(data ? data.id : null);
  }

  function groupFormHtml(g) {
    return `
    <div class="modal-form">
      <div class="form-field">
        <label>小组名称</label>
        <input type="text" id="g-name" value="${g ? g.name : ''}" placeholder="例如：红队、第一组">
      </div>
      <div class="form-field">
        <label>小组颜色</label>
        <div class="color-picker-row">
          ${GROUP_COLORS.map(c => `<span class="color-swatch ${g && g.color === c ? 'selected' : ''}"
            style="background:${c}" data-color="${c}"
            onclick="document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));this.classList.add('selected')"></span>`
    ).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
        <button class="btn-primary" id="save-group-btn">${g ? '保存' : '创建'}</button>
      </div>
    </div>`;
  }

  function saveGroup(id) {
    const name = document.getElementById('g-name').value.trim();
    const colorEl = document.querySelector('.color-swatch.selected');
    const color = colorEl ? colorEl.dataset.color : GROUP_COLORS[0];
    if (!name) { UI.toast('请输入小组名称', 'warning'); return; }
    if (id) {
      Store.groups.update(id, { name, color });
      UI.toast('小组已更新', 'success');
    } else {
      Store.groups.create({ classId: currentClassId, name, color });
      UI.toast('小组已创建', 'success');
    }
    UI.closeModal();
    render();
    Students.render();  // refresh student cards' stripe colors
  }

  function _edit(id) {
    const g = Store.groups.find(id);
    if (g) showCreateModal(g);
  }

  function _delete(id) {
    const g = Store.groups.find(id);
    if (!g) return;
    const members = Store.students.byClass(currentClassId).filter(s => s.groupIds && s.groupIds.includes(id));
    UI.confirm(
      `确定删除小组「${g.name}」吗？${members.length ? `<br>${members.length}名成员将被移出小组。` : ''}`,
      () => {
        Store.groups.remove(id);
        UI.toast('小组已删除', 'success');
        render();
        Students.render();
      }
    );
  }

  function _addMember(groupId) {
    const g = Store.groups.find(groupId);
    const candidates = Store.students.byClass(currentClassId)
      .filter(s => !s.groupIds || !s.groupIds.includes(groupId));
    if (candidates.length === 0) { UI.toast('没有可添加的学生', 'info'); return; }

    const renderCandidates = (keyword = '') => {
      const kw = keyword.trim();
      const list = kw
        ? candidates.filter(s => {
          const pn = ((getPet(s.petType)==null?void 0:getPet(s.petType)).name || '').toLowerCase();
          return s.name.includes(keyword) || pn.includes(kw.toLowerCase());
        })
        : candidates;
      return list.map(s => {
        const p = s.petType ? getPet(s.petType) : null;
        const petLine = p ? `<div class="am-pet">${p.emoji} ${p.name}</div>` : '';
        return `
        <div class="am-card ${s._checked ? 'am-card--selected' : ''}" data-id="${s.id}">
          <span class="am-check">✓</span>
          <div class="am-info">
            <div class="am-name">${s.name}</div>
            ${petLine}
          </div>
          ${(s.groupIds && s.groupIds.length > 0)
            ? `<span class="am-cur-group">当前在: ${(Store.groups.find(s.groupIds[0])==null?void 0:Store.groups.find(s.groupIds[0])).name || '其他组'}</span>`
            : ''}
        </div>`;
      }).join('') || '<p style="color:var(--text-muted);text-align:center;padding:1.5rem 0">没有匹配的学生</p>';
    };

    UI.openModal(`➕ 添加成员 — ${g ? g.name : ''}`, `
      <div class="modal-form">
        <div class="am-toolbar">
          <input type="text" id="am-search" placeholder="🔍 搜索姓名 / 宠物" class="am-search-input">
          <span id="am-count" class="am-count">已选 0 人</span>
        </div>
        <div class="am-select-all-row">
          <button class="btn-ghost btn-sm" id="am-select-all">全选</button>
          <button class="btn-ghost btn-sm" id="am-clear-all">清空</button>
        </div>
        <div id="am-list" class="am-list">${renderCandidates()}</div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
          <button class="btn-primary" id="do-add-member-btn">确认添加</button>
        </div>
      </div>`, { wide: true });

    // 状态：已勾选的 id 集合
    const selected = new Set();

    const updateCount = () => {
      document.getElementById('am-count').textContent = `已选 ${selected.size} 人`;
    };

    const rebindCards = () => {
      document.querySelectorAll('.am-card').forEach(card => {
        const id = card.dataset.id;
        card.classList.toggle('am-card--selected', selected.has(id));
        card.onclick = () => {
          selected.has(id) ? selected.delete(id) : selected.add(id);
          card.classList.toggle('am-card--selected', selected.has(id));
          updateCount();
        };
      });
    };

    rebindCards();

    document.getElementById('am-search').oninput = function () {
      document.getElementById('am-list').innerHTML = renderCandidates(this.value.trim());
      rebindCards();
    };

    document.getElementById('am-select-all').onclick = () => {
      document.querySelectorAll('.am-card').forEach(card => selected.add(card.dataset.id));
      rebindCards(); updateCount();
    };
    document.getElementById('am-clear-all').onclick = () => {
      selected.clear(); rebindCards(); updateCount();
    };

    // footer 已被 openModal 移走重建，需 setTimeout 确保新 DOM 节点可被找到
    setTimeout(() => {
      const confirmBtn = document.getElementById('do-add-member-btn');
      if (!confirmBtn) return;
      confirmBtn.onclick = () => {
        if (selected.size === 0) { UI.toast('请先选择学生', 'warning'); return; }
        selected.forEach(id => {
          const s = Store.students.find(id);
          const existing = (s && s.groupIds) ? s.groupIds : [];
          const newIds = existing.includes(groupId) ? existing : [...existing, groupId];
          Store.students.update(id, { groupIds: newIds, groupId: newIds[0] || null });
        });
        UI.closeModal();
        UI.toast(`已添加 ${selected.size} 名成员`, 'success');
        render();
        Students.render();
      };
    }, 0);
  }

  function _removeMember(studentId, groupId) {
    const s = Store.students.find(studentId);
    if (!s) return;
    const newGroupIds = (s.groupIds || []).filter(id => id !== groupId);
    Store.students.update(studentId, { groupIds: newGroupIds, groupId: newGroupIds[0] || null });
    render();
    Students.render();
  }

  return { init, render, _edit, _delete, _addMember, _removeMember };
})();
