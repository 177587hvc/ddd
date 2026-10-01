/* LUCKY-WHEEL.JS - Reward lucky wheel */
const LuckyWheel = (() => {
  let currentClassId = null, isSpinning = false, rotation = 0, wheelItems = [];
  function init(classId) {
    currentClassId = classId; bindEvents();
    window.addEventListener('pets-data-sync', () => { const modal = document.getElementById('lucky-wheel'); if (modal && modal.classList.contains('open') && currentClassId) showWheel(); });
  }
  function bindEvents() {
    const closeBtn = document.getElementById('lw-close'); if (closeBtn) closeBtn.onclick = hideWheel;
    const spinBtn = document.getElementById('lw-spin-btn'); if (spinBtn) spinBtn.onclick = spin;
    const resultClose = document.getElementById('lw-result-close'); if (resultClose) resultClose.onclick = () => { document.getElementById('lw-result-wrap').classList.add('hidden'); };
    const settingsBtn = document.getElementById('lw-settings-btn'); if (settingsBtn) settingsBtn.onclick = () => openSpinSettingsModal();
    const editBtn = document.getElementById('lw-edit-btn'); if (editBtn) editBtn.onclick = () => { hideWheel(); openConfigModal(); };
    const popoutBtn = document.getElementById('lw-popout-btn'); if (popoutBtn) popoutBtn.onclick = () => { hideWheel(); window.open('lucky-wheel.html?classId=' + currentClassId, 'LuckyWheel', 'width=800,height=850,menubar=no'); };
  }
  function getSettings() {
    if (!currentClassId) return null;
    const key = 'pets_luckyWheel_' + currentClassId;
    const saved = localStorage.getItem(key);
    if (saved) { try { return JSON.parse(saved); } catch(e) { return null; } }
    return { title: '奖励大转盘', spinDuration: 3, rewards: '免作业一次\n加5分福利积分\n换座位优先权\n当一天课代表\n免除一次值日\n小卖部8折券' };
  }
  function saveSettings(data) {
    if (!currentClassId) return;
    localStorage.setItem('pets_luckyWheel_' + currentClassId, JSON.stringify(data));
    localStorage.setItem('pets_last_write', Date.now().toString());
    localStorage.setItem('pets_sync_dirty', '1');
    if (typeof Store !== 'undefined' && Store.forceSync) Store.forceSync();
  }
  function openConfigModal() {
    const settings = getSettings();
    UI.openModal('🎡 奖励大转盘设置', '<div class="modal-form"><div class="form-field"><label>大转盘标题</label><input type="text" id="lw-cfg-title" value="' + (settings.title || '奖励大转盘') + '" placeholder="转盘顶部显示的标题"></div><div class="form-field"><label>奖励列表 (可编辑，每行一个奖励项)</label><textarea id="lw-cfg-rewards" rows="8" placeholder="输入奖励，一行一个">' + settings.rewards + '</textarea></div><div class="modal-footer" style="margin-top:1rem"><button class="btn-ghost" id="lw-cfg-cancel-btn">取消</button><button class="btn-primary" id="lw-gen-btn">保存并展示转盘!</button></div></div>', { wide: true });
    document.getElementById('lw-cfg-cancel-btn').onclick = () => { UI.closeModal(); const s = getSettings(); if (s && s.rewards && s.rewards.split('\n').filter(x => x.trim()).length >= 2) showWheel(); };
    document.getElementById('lw-gen-btn').onclick = () => {
      const existing = getSettings();
      const data = { title: document.getElementById('lw-cfg-title').value || '奖励大转盘', spinDuration: existing.spinDuration || 3, rewards: document.getElementById('lw-cfg-rewards').value.trim() };
      if (!data.rewards) { UI.toast('请输入至少一个奖励项', 'warning'); return; }
      saveSettings(data); UI.closeModal(); showWheel();
    };
  }
  function openSpinSettingsModal() {
    const settings = getSettings();
    const dur = settings.spinDuration || 3;
    UI.openModal('⚙️ 转盘设置', '<div class="modal-form"><div class="form-field"><label>转盘旋转秒数</label><div style="display:flex;align-items:center;gap:12px"><input type="range" id="lw-spin-dur-range" min="1" max="15" step="0.5" value="' + dur + '" style="flex:1;accent-color:#3b82f6"><span id="lw-spin-dur-val" style="font-size:1.5rem;font-weight:700;color:#3b82f6;min-width:48px;text-align:center">' + dur + '秒</span></div><p style="font-size:.8rem;color:var(--text-muted);margin-top:.5rem">拖动滑块设置转盘旋转的持续时间（1 ~ 15 秒）</p></div><div class="modal-footer" style="margin-top:1rem"><button class="btn-ghost" id="lw-spin-cfg-cancel">取消</button><button class="btn-primary" id="lw-spin-cfg-save">保存</button></div></div>', { narrow: true });
    const rangeEl = document.getElementById('lw-spin-dur-range');
    const valEl = document.getElementById('lw-spin-dur-val');
    rangeEl.oninput = () => { valEl.textContent = rangeEl.value + '秒'; };
    document.getElementById('lw-spin-cfg-cancel').onclick = () => { UI.closeModal(); showWheel(); };
    document.getElementById('lw-spin-cfg-save').onclick = () => { const newDur = parseFloat(rangeEl.value); saveSettings({ ...getSettings(), spinDuration: newDur }); UI.closeModal(); UI.toast('✅ 已设置转盘旋转 ' + newDur + ' 秒', 'success'); showWheel(); };
  }
  function showWheel() {
    const settings = getSettings();
    if (!settings || !settings.rewards || settings.rewards.split('\n').filter(s => s.trim()).length < 2) { openConfigModal(); return; }
    wheelItems = settings.rewards.split('\n').map(s => s.trim()).filter(Boolean);
    const titleEl = document.querySelector('.lw-title-new'); if (titleEl) titleEl.innerHTML = (settings.title || '转盘') + ' <i class="ri-external-link-line" style="font-size:1.2rem;margin-left:5px"></i>';
    document.getElementById('lucky-wheel').classList.add('open');
    document.getElementById('lw-result-wrap').classList.add('hidden');
    rotation = 0; drawWheel();
  }
  function hideWheel() { const ov = document.getElementById('lucky-wheel'); if (ov) ov.classList.remove('open'); }
  function drawWheel() {
    const canvas = document.getElementById('lw-canvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width, height = canvas.height, centerX = width/2, centerY = height/2, radius = width/2 - 10;
    ctx.clearRect(0,0,width,height);
    const sliceAngle = (Math.PI*2)/wheelItems.length;
    const colors = ['#f47474','#a682e6','#87e0f2','#a0e4b0','#f9e282'];
    ctx.save(); ctx.translate(centerX, centerY);
    wheelItems.forEach((item, i) => {
      const angle = i*sliceAngle;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,radius,angle,angle+sliceAngle); ctx.closePath();
      ctx.fillStyle = colors[i%colors.length]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.rotate(angle+sliceAngle/2); ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px "Microsoft YaHei", sans-serif'; ctx.shadowBlur = 2; ctx.shadowColor = 'rgba(0,0,0,0.2)';
      const text = item.length > 8 ? item.substring(0,7)+'..' : item;
      ctx.fillText(text, radius-50, 10); ctx.restore();
    });
    ctx.restore();
    canvas.style.transform = 'rotate(' + rotation + 'rad)';
    canvas.style.willChange = 'transform';
  }
  function spin() {
    if (isSpinning || wheelItems.length === 0) return;
    isSpinning = true;
    const spinBtn = document.getElementById('lw-spin-btn'); if (spinBtn) spinBtn.style.pointerEvents = 'none';
    document.getElementById('lw-result-wrap').classList.add('hidden');
    const totalRotation = Math.PI*2*(6+Math.random()*6);
    const spinSecs = getSettings().spinDuration || 3;
    const startRotation = rotation;
    const canvas = document.getElementById('lw-canvas');
    if (canvas) {
      canvas.style.transition = 'transform ' + spinSecs + 's cubic-bezier(0.17,0.67,0.12,1.0)';
      rotation = startRotation + totalRotation;
      canvas.style.transform = 'rotate(' + rotation + 'rad)';
      const onEnd = () => { canvas.removeEventListener('transitionend', onEnd); canvas.style.transition = ''; isSpinning = false; if (spinBtn) spinBtn.style.pointerEvents = 'auto'; showResult(); };
      canvas.addEventListener('transitionend', onEnd);
      setTimeout(() => { if (isSpinning) { canvas.removeEventListener('transitionend', onEnd); canvas.style.transition = ''; isSpinning = false; if (spinBtn) spinBtn.style.pointerEvents = 'auto'; showResult(); } }, spinSecs*1000+500);
    }
  }
  function showResult() {
    const normalizedRotation = rotation % (Math.PI*2);
    const pointerAngle = (Math.PI*1.5 - normalizedRotation + Math.PI*2) % (Math.PI*2);
    const sliceAngle = (Math.PI*2)/wheelItems.length;
    const index = Math.floor(pointerAngle/sliceAngle);
    const result = wheelItems[index];
    const displayRes = document.getElementById('lw-display-result-new'); if (displayRes) displayRes.textContent = result;
    document.getElementById('lw-result-text').textContent = result;
    document.getElementById('lw-result-wrap').classList.remove('hidden');
    if (typeof Effects !== 'undefined' && Effects.confetti) Effects.confetti();
  }
  return { init, openConfigModal, showWheel };
})();