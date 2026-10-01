/* ═══════════════════════ SHOP.JS ═══════════════════════
   Shop management - items CRUD + student redemption
═══════════════════════════════════════════════════════════ */

const Shop = (() => {

  let currentClassId = null;
  let _modalGridId = null;

  function init(classId) {
    currentClassId = classId;
    const addBtn = document.getElementById('btn-create-shop-item');
    if (addBtn) addBtn.onclick = () => showAddItemModal();
    const recordsBtn = document.getElementById('btn-shop-redeem-records');
    if (recordsBtn) recordsBtn.onclick = () => showRedeemRecordsModal();
    // Only render if tab is visible
    if (document.getElementById('tab-shop').classList.contains('active')) {
      render();
    }
  }

  function render(containerId) {
    const grid = document.getElementById(containerId || 'shop-grid');
    if (!grid) return;
    // Only render if tab is active (or if it's a modal)
    if (!containerId) {
      const tab = document.getElementById('tab-shop');
      if (tab && !tab.classList.contains('active')) return;
    }

    const items = Store.shop.byClass(currentClassId);
    if (items.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:3rem;opacity:.4;margin-bottom:.75rem">🛒</div>
        <p>商城暂无商品，点击「添加商品」创建</p>
      </div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      const stockStr = item.stock < 0 ? '不限库存' : (item.stock === 0 ? '<span style="color:var(--danger)">已售罄</span>' : `库存: ${item.stock}`);
      const iconHtml = (item.icon || '').startsWith('ri-') ? `<i class="ri ${item.icon}" aria-hidden="true"></i>` : (item.icon || '🎁');
      return `
      <div class="shop-item-card"${item.color ? ` style="--shop-card-color:${item.color}"` : ''}>
        <span class="shop-item-icon">${iconHtml}</span>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc || '精彩商品'}</div>
        <div class="shop-item-footer">
          <span class="shop-item-price">🏆 ${item.price} 积分</span>
          <span class="shop-item-stock">${stockStr}</span>
        </div>
        <div class="shop-item-actions">
          <button class="btn-primary btn-sm" onclick="Shop._redeem('${item.id}')">兑换</button>
          <button class="btn-ghost btn-sm" onclick="Shop._edit('${item.id}')">编辑</button>
          <button class="btn-ghost btn-sm" style="color:var(--danger)" onclick="Shop._delete('${item.id}')">删除</button>
        </div>
      </div>`;
    }).join('');
  }

  function showAddItemModal(data) {
    const title = (data ? '编辑商品' : '✨ 添加新商品');
    UI.openModal(title, itemFormHtml(data), { wide: true });
    document.getElementById('save-item-btn').onclick = () => saveItem(data ? data.id : null);

    bindItemForm();
  }

  function bindItemForm() {
    document.querySelectorAll('.shop-icon-pick').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.shop-icon-pick').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('item-icon-val').value = btn.dataset.icon;
      };
    });
    document.querySelectorAll('.shop-color-pick').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.shop-color-pick').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('item-color-val').value = btn.dataset.color;
      };
    });
    document.querySelectorAll('.shop-icon-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.shop-icon-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const cat = tab.dataset.cat;
        const grid = document.getElementById('shop-icon-grid');
        const cats = SHOP_ICONS_CATEGORIES;
        const icons = cats[cat] ? cats[cat].icons : [];
        grid.innerHTML = icons.map(ic => {
          const cur = document.getElementById('item-icon-val').value;
          return `<button type="button" class="shop-icon-pick ${cur === ic ? 'selected' : ''}" data-icon="${ic}">
            <i class="ri ${ic}" aria-hidden="true"></i>
          </button>`;
        }).join('');
        bindItemForm();
      };
    });
  }

  function itemFormHtml(item) {
    const cats = SHOP_ICONS_CATEGORIES;
    const catKeys = Object.keys(cats);
    const curIcon = item && item.icon ? item.icon : (SHOP_ICONS[0] || (cats[catKeys[0]] ? cats[catKeys[0]].icons[0] : undefined));
    const activeCat = catKeys.find(k => ((cats[k] ? cats[k].icons : []) || []).includes(curIcon)) || catKeys[0];
    const curColor = item && item.color ? item.color : SHOP_COLORS[1];
    const isMedal = item ? !!item.isMedal : false;
    const catsHtml = Object.entries(cats).map(([key, val]) =>
      `<button type="button" class="shop-icon-tab ${key === activeCat ? 'active' : ''}" data-cat="${key}">
        <i class="ri ${val.icon}"></i>${val.label}
      </button>`
    ).join('');
    const iconsHtml = ((cats[activeCat] ? cats[activeCat].icons : []) || []).map(ic =>
      `<button type="button" class="shop-icon-pick ${curIcon === ic ? 'selected' : ''}" data-icon="${ic}">
        <i class="ri ${ic}" aria-hidden="true"></i>
      </button>`
    ).join('');
    const colorsHtml = SHOP_COLORS.map(c =>
      `<button type="button" class="shop-color-pick ${c === curColor ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`
    ).join('');
    return `
    <div class="modal-form shop-item-form">
      <div class="shop-form-row">
        <div class="form-field">
          <label>商品名称</label>
          <input type="text" id="item-name" value="${item ? item.name : ''}" placeholder="例如: 免作业卡">
        </div>
        <div class="form-field">
          <label>价格 (积分)</label>
          <input type="number" id="item-price" value="${item ? item.price : 1}" min="1">
        </div>
      </div>
      <div class="form-field">
        <label>描述说明</label>
        <textarea id="item-desc" rows="3" placeholder="这个奖品有什么作用...">${item ? item.desc || '' : ''}</textarea>
      </div>
      <div class="form-field">
        <label>卡片配色</label>
        <div class="shop-color-row">${colorsHtml}</div>
        <input type="hidden" id="item-color-val" value="${curColor}">
      </div>
      <div class="form-field">
        <label>选择图标</label>
        <div class="shop-icon-tabs">${catsHtml}</div>
        <div id="shop-icon-grid" class="shop-icon-grid">${iconsHtml}</div>
        <input type="hidden" id="item-icon-val" value="${curIcon}">
      </div>
      <div class="form-field shop-form-extra">
        <label class="shop-inline-label">
          <span>库存</span>
          <input type="number" id="item-stock" value="${item ? item.stock : 10}" min="-1" class="shop-input-sm" placeholder="-1不限">
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
        <button class="btn-primary" id="save-item-btn"><i class="ri ri-save-line"></i> 保存更改</button>
      </div>
    </div>`;
  }

  function saveItem(id) {
    const name = document.getElementById('item-name').value.trim();
    const desc = document.getElementById('item-desc').value.trim();
    const price = Number(document.getElementById('item-price').value);
    const stock = Number(document.getElementById('item-stock').value);
    const icon = document.getElementById('item-icon-val').value;
    const color = document.getElementById('item-color-val').value || '';
    if (!name) { UI.toast('请输入商品名称', 'warning'); return; }
    if (isNaN(price) || price < 1) { UI.toast('价格至少为1积分', 'warning'); return; }
    if (id) {
      Store.shop.update(id, { name, desc, price, stock, icon, color });
      UI.toast('商品已更新', 'success');
    } else {
      Store.shop.create({ classId: currentClassId, name, desc, price, stock, icon, color });
      UI.toast('商品已添加', 'success');
    }
    UI.closeModal();
    refresh();
  }

  function refresh() {
    const grid = document.getElementById('shop-modal-grid') || document.getElementById('shop-grid');
    if (grid) render(grid.id);
  }

  function openAsModal() {
    const body = `
      <div class="shop-modal-toolbar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;gap:.75rem;flex-wrap:wrap">
        <span style="font-size:.88rem;color:var(--text-muted);flex:1;min-width:200px">管理商品，学生可用总积分兑换</span>
        <button type="button" class="btn-ghost btn-sm" id="shop-modal-sync-btn" style="color:var(--primary);font-weight:600">🔄 同步到所有班级</button>
        <button type="button" class="btn-ghost btn-sm" id="shop-modal-records-btn">📋 兑换记录</button>
        <button type="button" class="btn-primary btn-sm" id="shop-modal-add-btn">＋ 添加商品</button>
      </div>
      <div id="shop-modal-grid" class="shop-grid"></div>`;
    UI.openModal('🛒 小卖部', body, { wide: true });
    _modalGridId = 'shop-modal-grid';
    render(_modalGridId);
    document.getElementById('shop-modal-add-btn').onclick = () => showAddItemModal();
    document.getElementById('shop-modal-records-btn').onclick = () => showRedeemRecordsModal();
    document.getElementById('shop-modal-sync-btn').onclick = () => syncToAllClasses();
  }

  function showRedeemRecordsModal() {
    const records = Store.records.byClass(currentClassId)
      .filter(r => r.type === 'redeem')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const itemNameRe = /兑换商品：([^（]+)/;

    function renderList(filterKw) {
      const kw = (filterKw || '').trim().toLowerCase();
      const filtered = kw
        ? records.filter(r => (r.studentName || '').toLowerCase().includes(kw))
        : records;
      const listEl = document.getElementById('shop-redeem-list');
      if (!listEl) return;
      if (filtered.length === 0) {
        listEl.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:2rem">${records.length === 0 ? '暂无兑换记录' : '未找到匹配的学生'}</p>`;
        return;
      }
      listEl.innerHTML = filtered.map(r => {
        const match = (r.reason || '').match(itemNameRe);
        const itemName = match ? match[1].trim() : (r.reason || '兑换');
        const time = r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN') : '-';
        const isUsed = r.useStatus === 'used';
        const tagText = isUsed ? '已使用' : '未使用';
        const tagColor = isUsed ? '#16a34a' : '#f59e0b';
        const tagBg = isUsed ? 'rgba(22,163,74,.12)' : 'rgba(245,158,11,.12)';
        const tagBorder = isUsed ? 'rgba(22,163,74,.35)' : 'rgba(245,158,11,.35)';
        const tagHtml = `<button type="button" class="srri-status-tag" data-rid="${r.id}"
            style="margin-left:.5rem;padding:.15rem .55rem;border-radius:999px;border:1px solid ${tagBorder};background:${tagBg};color:${tagColor};font-size:.75rem;font-weight:600;cursor:pointer;line-height:1.4">${tagText}</button>`;
        return `<div class="shop-redeem-record-item">
          <span class="srri-name">${r.studentName || '未知'}</span>
          <span class="srri-item">🎁 ${itemName}${tagHtml}</span>
          <span class="srri-badges">${Math.abs(r.amount || 0)} 积分</span>
          <span class="srri-time">${time}</span>
        </div>`;
      }).join('');

      // 绑定标签点击
      listEl.querySelectorAll('.srri-status-tag').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const rid = btn.dataset.rid;
          document.querySelectorAll('.srri-status-menu').forEach(el => el.remove());
          const menu = document.createElement('div');
          menu.className = 'srri-status-menu';
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
              // 更新内存中的 records 引用，避免重开弹窗
              const rec = records.find(x => x.id === rid);
              if (rec) rec.useStatus = val;
              menu.remove();
              renderList(document.getElementById('shop-redeem-search') ? document.getElementById('shop-redeem-search').value : '');
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

    UI.openModal('📋 兑换记录', `
      <label class="si-search-wrap" style="margin-bottom:1rem">
        <i class="ri ri-search-line si-search-icon" aria-hidden="true"></i>
        <input type="text" id="shop-redeem-search" class="si-search-input" placeholder="搜索学生姓名">
      </label>
      <div id="shop-redeem-list" class="shop-redeem-list" style="max-height:400px;overflow-y:auto"></div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick="UI.closeModal()">关闭</button>
      </div>`, { wide: true });

    renderList();
    document.getElementById('shop-redeem-search').oninput = function () {
      renderList(this.value);
    };
  }

  function _edit(id) {
    const item = Store.shop.find(id);
    if (item) showAddItemModal(item);
  }

  function _delete(id) {
    const item = Store.shop.find(id);
    if (!item) return;
    UI.confirm(`确定删除商品「${item.name}」吗？`, () => {
      Store.shop.remove(id);
      UI.toast('商品已删除', 'success');
      refresh();
    });
  }

  function syncToAllClasses() {
    const currentTeacher = Store.session.get();
    if (!currentTeacher) {
      UI.toast('请先登录', 'warning');
      return;
    }

    const allClasses = Store.classes.byTeacher(currentTeacher.id);
    if (allClasses.length <= 1) {
      UI.toast('您只有一个班级，无需同步', 'info');
      return;
    }

    const currentItems = Store.shop.byClass(currentClassId);
    if (currentItems.length === 0) {
      UI.toast('当前班级没有商品，无法同步', 'warning');
      return;
    }

    const otherClasses = allClasses.filter(c => c.id !== currentClassId);
    const classNames = otherClasses.map(c => c.name).join('、');

    UI.confirm(
      `确定要将当前班级的 ${currentItems.length} 个商品同步到其他 ${otherClasses.length} 个班级吗？\n\n目标班级：${classNames}\n\n⚠️ 注意：目标班级的现有商品将被完全替换！`,
      () => {
        let totalSynced = 0;
        
        otherClasses.forEach(targetClass => {
          // 删除目标班级的所有现有商品
          const existingItems = Store.shop.byClass(targetClass.id);
          existingItems.forEach(item => {
            Store.shop.remove(item.id);
          });

          // 复制当前班级的商品到目标班级
          currentItems.forEach(item => {
            Store.shop.create({
              classId: targetClass.id,
              name: item.name,
              desc: item.desc,
              price: item.price,
              stock: item.stock,
              icon: item.icon,
              color: item.color,
              isMedal: item.isMedal || false
            });
            totalSynced++;
          });
        });

        UI.toast(`✅ 成功同步！已将 ${currentItems.length} 个商品同步到 ${otherClasses.length} 个班级`, 'success', 3000);
      }
    );
  }

  function _redeem(itemId) {
    const item = Store.shop.find(itemId);
    const students = Store.students.byClass(currentClassId);
    if (!item || students.length === 0) { UI.toast('没有可兑换的学生', 'info'); return; }

    const groups = Store.groups.byClass(currentClassId);
    const maxStock = item.stock < 0 ? 99 : item.stock;

    const groupOpts = `<option value="">全部学生</option>` +
      groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    function buildStudentCards(list) {
      if (list.length === 0) return `<p style="color:var(--text-muted);text-align:center;padding:1.5rem 0">该分组下暂无学生</p>`;
      return list.map(s => `
        <div class="am-card" data-id="${s.id}">
          <span class="am-check">✓</span>
          <div class="am-info">
            <div class="am-name">${s.name}</div>
            <div class="am-pet">🏆 ${getLeaderboardWelfareScore(s)} 积分</div>
          </div>
        </div>`).join('');
    }

    UI.openModal(`🛒 兑换：${item.name}`, `
      <div class="modal-form">
        <p style="margin-bottom:1rem;color:var(--text-muted)">
          单价：🏆 <b>${item.price}</b> 积分&nbsp;&nbsp;&nbsp;&nbsp;库存：${item.stock < 0 ? '不限' : item.stock}
        </p>
        <div class="form-field">
          <label>选择分组（可选）</label>
          <select id="redeem-group" style="width:100%">${groupOpts}</select>
        </div>
        <div class="form-field">
          <label>选择兑换学生</label>
          <div class="am-toolbar" style="margin-bottom:.5rem">
            <input type="text" id="redeem-search" placeholder="🔍 搜索姓名" class="am-search-input">
            <span id="redeem-sel-count" class="am-count">已选 0 人</span>
          </div>
          <div class="am-select-all-row">
            <button class="btn-ghost btn-sm" id="redeem-select-all">全选</button>
            <button class="btn-ghost btn-sm" id="redeem-clear-all">清空</button>
          </div>
          <div id="redeem-student-list" class="am-list" style="max-height:220px">${buildStudentCards(students)}</div>
        </div>
        <div class="form-field">
          <label>每人兑换数量</label>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="number" id="redeem-qty" value="1" min="1" max="${maxStock || 99}"
              style="width:90px;padding:.4rem .6rem;border:1.5px solid var(--border);border-radius:8px;font-size:1rem;text-align:center">
            <span id="redeem-cost-preview" style="font-size:.95rem;color:var(--primary);font-weight:600">
              共消耗 ${item.price} 积分
            </span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" onclick="UI.closeModal()">取消</button>
          <button class="btn-primary" id="do-redeem-btn">确认兑换</button>
        </div>
      </div>`, { wide: true });

    const selected = new Set();

    const updateCount = () => {
      const qty = Math.max(1, parseInt(document.getElementById('redeem-qty').value) || 1);
      document.getElementById('redeem-sel-count').textContent = `已选 ${selected.size} 人`;
      document.getElementById('redeem-cost-preview').textContent = `共消耗 ${item.price * qty * Math.max(selected.size, 1)} 积分`;
    };

    const rebindCards = () => {
      document.querySelectorAll('#redeem-student-list .am-card').forEach(card => {
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

    let currentList = students;

    document.getElementById('redeem-group').onchange = function () {
      const gid = this.value;
      currentList = gid ? students.filter(s => s.groupIds && s.groupIds.includes(gid)) : students;
      const kw = document.getElementById('redeem-search').value.trim();
      const filtered = kw ? currentList.filter(s => s.name.includes(kw)) : currentList;
      document.getElementById('redeem-student-list').innerHTML = buildStudentCards(filtered);
      rebindCards();
    };

    document.getElementById('redeem-search').oninput = function () {
      const kw = this.value.trim();
      const filtered = kw ? currentList.filter(s => s.name.includes(kw)) : currentList;
      document.getElementById('redeem-student-list').innerHTML = buildStudentCards(filtered);
      rebindCards();
    };

    document.getElementById('redeem-select-all').onclick = () => {
      document.querySelectorAll('#redeem-student-list .am-card').forEach(c => selected.add(c.dataset.id));
      rebindCards(); updateCount();
    };

    document.getElementById('redeem-clear-all').onclick = () => {
      selected.clear(); rebindCards(); updateCount();
    };

    document.getElementById('redeem-qty').oninput = updateCount;

    setTimeout(() => {
      const confirmBtn = document.getElementById('do-redeem-btn');
      if (!confirmBtn) return;
      confirmBtn.onclick = () => {
        if (selected.size === 0) { UI.toast('请选择至少一名学生', 'warning'); return; }
        const qty = Math.max(1, parseInt(document.getElementById('redeem-qty').value) || 1);
        const sids = [...selected];

        // 预检查库存（总需求 = 人数 × 数量）
        const totalNeed = sids.length * qty;
        if (item.stock >= 0 && item.stock < totalNeed) {
          UI.toast(`库存不足，需要 ${totalNeed} 件，当前剩余 ${item.stock} 件`, 'warning');
          return;
        }

        // 预检查每人积分
        for (const sid of sids) {
          const s = Store.students.find(sid);
          if (!s) continue;
          const welfare = getLeaderboardWelfareScore(s);
          const cost = item.price * qty;
          if (welfare < cost) {
            UI.toast(`${s.name} 积分不足（需 ${cost}，当前 ${welfare}）`, 'warning');
            return;
          }
        }

        let failCount = 0;
        for (const sid of sids) {
          for (let i = 0; i < qty; i++) {
            const result = Store.shop.redeem(itemId, sid);
            if (!result.ok) { failCount++; break; }
          }
        }

        UI.closeModal();
        if (failCount === 0) {
          UI.toast(`兑换成功！共 ${sids.length} 人${qty > 1 ? `，每人 ${qty} 件` : ''}`, 'success');
        } else {
          UI.toast(`部分兑换失败（${failCount} 人）`, 'warning');
        }
        refresh();
        Records.render(currentClassId);
        Students.render();
      };
    }, 0);
  }

  return { init, render, refresh, openAsModal, _edit, _delete, _redeem };
})();
