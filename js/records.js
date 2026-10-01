/* ═══════════════════════ RECORDS.JS ═══════════════════════
   Score records - list and filter（按学生维度分组展示 + 导出）
═══════════════════════════════════════════════════════════ */

const Records = (() => {

  let currentClassId = null;

  const TYPE_ICONS = { add: '➕', deduct: '➖', feed: '🍗', redeem: '🛒' };
  const TYPE_LABELS = { add: '加分', deduct: '扣分', feed: '投喂', redeem: '兑换' };

  function init(classId) {
    currentClassId = classId;
    document.getElementById('records-filter-type').onchange = () => render(classId);
    document.getElementById('records-filter-student').onchange = () => render(classId);
    const modeEl = document.getElementById('records-filter-mode');
    if (modeEl) modeEl.onchange = () => render(classId);
    const exp = document.getElementById('btn-records-export');
    if (exp) exp.onclick = () => exportFilteredCsv();
    // Only render if tab is visible
    if (document.getElementById('tab-records').classList.contains('active')) {
      render(classId);
    }
  }

  /** 与列表一致：当前班级 + 类型/学生筛选，时间新→旧（不含投喂：投喂单独记一条仅用于喂养进度，非班级积分流水） */
  function getFilteredRecords() {
    if (!currentClassId) return [];
    const typeFilter = (document.getElementById('records-filter-type') ? document.getElementById('records-filter-type').value : '') || '';
    const studentFilter = (document.getElementById('records-filter-student') ? document.getElementById('records-filter-student').value : '') || '';
    let records = Store.records.byClass(currentClassId)
      .filter(r => r.type !== 'feed')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (typeFilter) records = records.filter(r => r.type === typeFilter);
    if (studentFilter) records = records.filter(r => r.studentId === studentFilter);
    return records;
  }

  function csvCell(v) {
    const s = String(v || '');
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /** 导出当前筛选结果为 CSV（UTF-8 BOM，Excel 可直接打开） */
  function exportFilteredCsv() {
    const records = getFilteredRecords();
    if (records.length === 0) {
      if (typeof UI !== 'undefined') UI.toast('没有可导出的记录', 'warning');
      return;
    }
    const headers = ['时间', '学生姓名', '宠物名称', '类型', '变动值', '说明', '记录ID'];
    const rows = records.map((r) => {
      const st = r.studentId ? Store.students.find(r.studentId) : null;
      const petName = (st||{}).petType ? ((getPet(st.petType) || {}).name || st.petType) : '';
      const typeZh = TYPE_LABELS[r.type] || r.type || '';
      let valueStr = '';
      if (r.type === 'feed') {
        const n = r.fedAmount != null ? r.fedAmount : 1;
        valueStr = `投喂 ${n}🍗`;
      } else if (r.type === 'redeem') {
        valueStr = `-${Math.abs(r.amount || 0)} 积分`;
      } else {
        valueStr = `${r.amount}`;
      }
      const t = r.createdAt
        ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false })
        : '';
      return [t, r.studentName || '', petName, typeZh, valueStr, r.reason || '', r.id || ''];
    });
    const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(cols => cols.map(csvCell).join(','))].join('\r\n');
    const cls = typeof Store !== 'undefined' && Store.classes ? Store.classes.find(currentClassId) : null;
    const safeClass = String((cls||{}).name || '班级').replace(/[/\\:*?"<>|]/g, '_');
    const day = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = `${safeClass}_积分记录_${day}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    if (typeof UI !== 'undefined') UI.toast(`已导出 ${records.length} 条记录`, 'success');
  }

  /** 班级内记录 → 按 studentId 分组，组内时间倒序；组顺序按该生「最新一条」时间倒序 */
  function groupRecordsByStudent(records) {
    const map = new Map();
    for (const r of records) {
      const sid = r.studentId || '';
      const key = sid || '__orphan__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return [...map.entries()].sort((a, b) => {
      const ta = a[1].length ? new Date(a[1][0].createdAt).getTime() : 0;
      const tb = b[1].length ? new Date(b[1][0].createdAt).getTime() : 0;
      return tb - ta;
    });
  }

  function recordItemHtml(r) {
    const s = Store.students.find(r.studentId);
    const petType = s ? s.petType : null;
    const petSrc = petType ? getPetImg(petType, 1) : '';
    const typeClass = r.type === 'add' ? 'add' : (r.type === 'deduct' ? 'deduct' : 'feed');
    return `
      <div class="record-item" data-student-id="${r.studentId || ''}" data-record-id="${r.id || ''}">
        <div class="record-type-badge ${typeClass}">${TYPE_ICONS[r.type] || '📌'}</div>
        ${petSrc ? `<img src="${petSrc}" class="record-item-pet" alt=""
            onerror="this.style.display='none'">` : ''}
        <div class="record-info">
          <div class="record-name">${r.studentName || '未知学生'}</div>
          <div class="record-reason">${r.reason || TYPE_LABELS[r.type] || ''}</div>
        </div>
        <div class="record-amount ${typeClass}">${r.type === 'feed' ? '-1 🍗' : (r.type === 'redeem' ? `-${Math.abs(r.amount || 0)} 积分` : `${r.amount > 0 ? '+' : ''}${r.amount} 分`)}</div>
        <div class="record-time">${timeAgo(r.createdAt)}</div>
        <button class="record-undo-btn" data-undo-id="${r.id || ''}" title="撤回此操作">撤销</button>
      </div>`;
  }

  let _displayLimit = 200;

  function render(classId) {
    if (classId) {
      currentClassId = classId;
      _displayLimit = 200; // Reset limit when entering a new class or explicitly calling init
    }
    const container = document.getElementById('records-list');
    if (!container) return;
    // Only render if tab is active
    const tab = document.getElementById('tab-records');
    if (tab && !tab.classList.contains('active')) return;

    // Reset limit if it's a fresh render from tab switch (optional)
    // _displayLimit = 200; 

    const allRecords = getFilteredRecords();
    UI.populateRecordsStudentFilter(Store.students.byClass(currentClassId));

    if (allRecords.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:3rem;opacity:.4;margin-bottom:.75rem">📝</div>
        <p>暂无积分记录</p>
      </div>`;
      return;
    }

    const records = allRecords.slice(0, _displayLimit);
    const hasMore = allRecords.length > _displayLimit;

    const studentFilter = document.getElementById('records-filter-student').value;
    const viewMode = (document.getElementById('records-filter-mode') ? document.getElementById('records-filter-mode').value : 'student') || 'student';
    let html = '';

    if (viewMode === 'time' || studentFilter) {
      html = records.map(r => recordItemHtml(r)).join('');
    } else {
      const groups = groupRecordsByStudent(records);
      html = groups.map(([sidKey, recs]) => {
        const sid = sidKey === '__orphan__' ? null : sidKey;
        const st = sid ? Store.students.find(sid) : null;
        const title = st ? st.name : ((recs[0] ? recs[0].studentName : '未知学生') || '未知学生');
        const petTag = (st==null?void 0:st.petType) ? ((getPet(st.petType) || {}).emoji || '') + ' ' + ((getPet(st.petType) || {}).name || '') : '';
        const body = recs.map(r => recordItemHtml(r)).join('');
        return `<section class="record-student-group">
          <header class="record-student-group__head">
            <span class="record-student-group__title">${title}${petTag ? ` · ${petTag}` : ''}</span>
            <span class="record-student-group__meta">${recs.length} 条</span>
          </header>
          <div class="record-student-group__list">${body}</div>
        </section>`;
      }).join('');
    }

    if (hasMore) {
      html += `
        <div style="text-align:center; padding:20px;">
          <button class="btn-ghost" id="btn-records-load-more" style="width:100%; max-width:300px; border:1px solid #e2e8f0;">
            显示更多记录 (当前展示前 ${_displayLimit} 条，共 ${allRecords.length} 条)
          </button>
        </div>`;
    }

    container.innerHTML = html;

    if (hasMore) {
      document.getElementById('btn-records-load-more').onclick = () => {
        _displayLimit += 500;
        render();
      };
    }

    container.querySelectorAll('.record-undo-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        undoRecord(btn.dataset.undoId);
      };
    });
  }

  function isAutoFeedFromScore(r) {
    if (r.type !== 'feed') return false;
    const reason = r.reason || '';
    return reason.startsWith('加分 (') || reason.startsWith('遥控加分 (') || reason.startsWith('加分自动投喂 (') || reason.startsWith('挑战成功自动投喂 (');
  }

  function undoRecord(recordId) {
    if (!recordId) return;
    const allRecords = Store.records.byClass(currentClassId);
    const target = allRecords.find(r => r.id === recordId);
    if (!target) { UI.toast('找不到该记录', 'error'); return; }

    const typeMap = { add: '加分', deduct: '扣分', feed: '投喂', redeem: '兑换' };
    const desc = `${target.studentName || '未知学生'} 的「${typeMap[target.type] || target.type}」操作（${target.amount > 0 ? '+' : ''}${target.amount}）`;

    UI.confirm(`确认撤回：${desc}？`, () => {
      const sid = target.studentId;
      let s = Store.students.find(sid);
      if (!s) { UI.toast('找不到学生', 'error'); return; }

      if (target.type === 'add' && target.amount > 0) {
        const tAdd = new Date(target.createdAt).getTime();
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
        if (target.legsDeltaChicken != null && target.legsDeltaFed != null) {
          Store.students.update(sid, {
            chickenLegs: (s.chickenLegs || 0) - target.legsDeltaChicken,
            fedLegs: (s.fedLegs || 0) - target.legsDeltaFed,
          });
        } else {
          Store.students.update(sid, {
            chickenLegs: Math.max(0, (s.chickenLegs || 0) - (target.amount || 0)),
          });
        }
        Store.records.removeById(target.id);
      } else if (target.type === 'redeem') {
        const price = Math.abs(target.amount || 0);
        Store.students.update(sid, {
          shopRedeemDebt: Math.max(0, (s.shopRedeemDebt || 0) - price),
        });
        Store.records.removeById(target.id);
      } else if (target.legsDeltaChicken != null && target.legsDeltaFed != null) {
        Store.students.update(sid, {
          chickenLegs: (s.chickenLegs || 0) - target.legsDeltaChicken,
          fedLegs: (s.fedLegs || 0) - target.legsDeltaFed,
        });
        Store.records.removeById(target.id);
      } else {
        if (target.type === 'deduct' && target.amount < 0) {
          Store.students.update(sid, { chickenLegs: (s.chickenLegs || 0) + Math.abs(target.amount) });
        } else if (target.type === 'add' && target.amount > 0) {
          Store.students.update(sid, { chickenLegs: Math.max(0, (s.chickenLegs || 0) - (target.amount || 0)) });
        }
        Store.records.removeById(target.id);
      }

      UI.toast(`↩ 已撤回 ${target.studentName || '该学生'} 的操作`, 'success');
      Students.render();
      render(currentClassId);
    }, '确认撤回操作');
  }

  return { init, render, exportFilteredCsv, getFilteredRecords };
})();