/**
 * LUCKY WHEEL MODULE
 * Handles reward lucky wheel configuration and spinning
 */
const LuckyWheel = (() => {

  let currentClassId = null;
  let isSpinning = false;
  let rotation = 0;
  let wheelItems = [];

  function init(classId) {
    currentClassId = classId;
    bindEvents();

    // 实时同步：当其他设备修改了转盘配置时，如果转盘正打开着，则自动重绘
    window.addEventListener('pets-data-sync', () => {
      const modal = document.getElementById('lucky-wheel');
      if (modal && modal.classList.contains('open') && currentClassId) {
        showWheel();
      }
    });
  }

  function bindEvents() {
    const closeBtn = document.getElementById('lw-close');
    if (closeBtn) closeBtn.onclick = hideWheel;

    const spinBtn = document.getElementById('lw-spin-btn');
    if (spinBtn) spinBtn.onclick = spin;

    const resultClose = document.getElementById('lw-result-close');
    if (resultClose) resultClose.onclick = () => {
      document.getElementById('lw-result-wrap').classList.add('hidden');
    };

    const settingsBtn = document.getElementById('lw-settings-btn');
    if (settingsBtn) settingsBtn.onclick = () => openSpinSettingsModal();
    const editBtn = document.getElementById('lw-edit-btn');
    if (editBtn) editBtn.onclick = () => { hideWheel(); openConfigModal(); };

    const popoutBtn = document.getElementById('lw-popout-btn');
    if (popoutBtn) {
      popoutBtn.onclick = () => {
        hideWheel();
        const url = `lucky-wheel.html?classId=${currentClassId}`;
        const w = 800, h = 850;
        const left = (window.screen.width - w) / 2;
        const top = (window.screen.height - h) / 2;
        window.open(url, 'LuckyWheel', `width=${w},height=${h},left=${left},top=${top},menubar=no`);
      };
    }
  }

  function getSettings() {
    if (!currentClassId) return null;
    const key = 'pets_luckyWheel_' + currentClassId;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { return null; }
    }
    return {
      title: '奖励大转盘',
      spinDuration: 3,
      rewards: '免作业一次\n加5分福利积分\n换座位优先权\n当一天课代表\n免除一次值日\n小卖部8折券'
    };
  }

  function saveSettings(data) {
    if (!currentClassId) return;
    const key = 'pets_luckyWheel_' + currentClassId;
    localStorage.setItem(key, JSON.stringify(data));
    // Trigger cross-device sync
    localStorage.setItem('pets_last_write', Date.now().toString());
    localStorage.setItem('pets_sync_dirty', '1');
    if (typeof Store !== 'undefined' && Store.forceSync) Store.forceSync();
  }

  function openConfigModal() {
    const settings = getSettings();
    const body = `
      <div class="modal-form">
        <div class="form-field">
          <label>大转盘标题</label>
          <input type="text" id="lw-cfg-title" value="${settings.title || '奖励大转盘'}" placeholder="转盘顶部显示的标题">
        </div>
        <div class="form-field">
          <label>奖励列表 (可编辑，每行一个奖励项)</label>
          <textarea id="lw-cfg-rewards" rows="8" placeholder="输入奖励，一行一个">${settings.rewards}</textarea>
        </div>
        <div class="modal-footer" style="margin-top:1rem">
          <button class="btn-ghost" id="lw-cfg-cancel-btn">取消</button>
          <button class="btn-primary" id="lw-gen-btn">保存并展示转盘!</button>
        </div>
      </div>
    `;
    UI.openModal('🎡 奖励大转盘设置', body, { wide: true });

    document.getElementById('lw-cfg-cancel-btn').onclick = () => {
      UI.closeModal();
      // Return to wheel if it was already configured, otherwise just close
      const s = getSettings();
      if (s && s.rewards && s.rewards.split('\n').filter(x => x.trim()).length >= 2) {
        showWheel();
      }
    };

    document.getElementById('lw-gen-btn').onclick = () => {
      const existing = getSettings();
      const data = {
        title: document.getElementById('lw-cfg-title').value || '奖励大转盘',
        spinDuration: existing.spinDuration || 3,
        rewards: document.getElementById('lw-cfg-rewards').value.trim()
      };
      if (!data.rewards) {
        UI.toast('请输入至少一个奖励项', 'warning');
        return;
      }
      saveSettings(data);
      UI.closeModal();
      showWheel();
    };
  }

  function openSpinSettingsModal() {
    const settings = getSettings();
    const dur = settings.spinDuration || 3;
    const body = `
      <div class="modal-form">
        <div class="form-field">
          <label>转盘旋转秒数</label>
          <div style="display:flex;align-items:center;gap:12px">
            <input type="range" id="lw-spin-dur-range" min="1" max="15" step="0.5" value="${dur}"
              style="flex:1;accent-color:#3b82f6">
            <span id="lw-spin-dur-val" style="font-size:1.5rem;font-weight:700;color:#3b82f6;min-width:48px;text-align:center">${dur}秒</span>
          </div>
          <p style="font-size:.8rem;color:var(--text-muted);margin-top:.5rem">拖动滑块设置转盘旋转的持续时间（1 ~ 15 秒）</p>
        </div>
        <div class="modal-footer" style="margin-top:1rem">
          <button class="btn-ghost" id="lw-spin-cfg-cancel">取消</button>
          <button class="btn-primary" id="lw-spin-cfg-save">保存</button>
        </div>
      </div>
    `;
    UI.openModal('⚙️ 转盘设置', body, { narrow: true });

    const rangeEl = document.getElementById('lw-spin-dur-range');
    const valEl = document.getElementById('lw-spin-dur-val');
    rangeEl.oninput = () => { valEl.textContent = rangeEl.value + '秒'; };

    document.getElementById('lw-spin-cfg-cancel').onclick = () => {
      UI.closeModal();
      showWheel();
    };

    document.getElementById('lw-spin-cfg-save').onclick = () => {
      const newDur = parseFloat(rangeEl.value);
      const existing = getSettings();
      saveSettings({ ...existing, spinDuration: newDur });
      UI.closeModal();
      UI.toast(`✅ 已设置转盘旋转 ${newDur} 秒`, 'success');
      showWheel();
    };
  }

  function showWheel() {
    const settings = getSettings();
    
    // 如果没有配置，或者奖励项太少，先打开配置弹窗
    if (!settings || !settings.rewards || settings.rewards.split('\n').filter(s => s.trim()).length < 2) {
      openConfigModal();
      return;
    }

    wheelItems = settings.rewards.split('\n').map(s => s.trim()).filter(Boolean);

    const titleEl = document.querySelector('.lw-title-new');
    if (titleEl) titleEl.innerHTML = `${settings.title || '转盘'} <i class="ri-external-link-line" style="font-size:1.2rem;margin-left:5px"></i>`;
    
    const displayRes = document.getElementById('lw-display-result-new');
    if (displayRes) displayRes.textContent = '||';

    document.getElementById('lucky-wheel').classList.add('open');
    document.getElementById('lw-result-wrap').classList.add('hidden');
    
    rotation = 0;
    drawWheel();
  }

  function hideWheel() {
    const ov = document.getElementById('lucky-wheel');
    if (ov) ov.classList.remove('open');
  }

  function drawWheel() {
    const canvas = document.getElementById('lw-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2 - 10;

    ctx.clearRect(0, 0, width, height);
    
    const sliceAngle = (Math.PI * 2) / wheelItems.length;
    const colors = ['#f47474', '#a682e6', '#87e0f2', '#a0e4b0', '#f9e282'];

    // 画静态轮盘（始终从 0° 开始画），旋转动画由 CSS transform 处理
    ctx.save();
    ctx.translate(centerX, centerY);

    wheelItems.forEach((item, i) => {
      const angle = i * sliceAngle;
      
      // Draw slice
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.rotate(angle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
      ctx.shadowBlur = 2;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      
      const text = item.length > 8 ? item.substring(0, 7) + '..' : item;
      ctx.fillText(text, radius - 50, 10);
      ctx.restore();
    });
    ctx.restore();

    // 将当前旋转角应用到 canvas 的 CSS transform（GPU 合成层，不触发重绘）
    canvas.style.transform = `rotate(${rotation}rad)`;
    canvas.style.willChange = 'transform';
  }

  function spin() {
    if (isSpinning) return;
    if (wheelItems.length === 0) return;

    isSpinning = true;
    const spinBtn = document.getElementById('lw-spin-btn');
    if (spinBtn) spinBtn.style.pointerEvents = 'none';
    
    const displayRes = document.getElementById('lw-display-result-new');
    if (displayRes) displayRes.textContent = '||';
    
    document.getElementById('lw-result-wrap').classList.add('hidden');

    const totalRotation = Math.PI * 2 * (6 + Math.random() * 6);
    const spinSecs = (getSettings().spinDuration || 3);
    const duration = spinSecs * 1000;
    const startTime = performance.now();
    const startRotation = rotation;

    // 使用 CSS transition 实现丝滑旋转（GPU 合成层，不占用 JS 线程）
    const canvas = document.getElementById('lw-canvas');
    if (canvas) {
      // cubic-bezier 模拟先快后慢的物理感效果
      canvas.style.transition = `transform ${spinSecs}s cubic-bezier(0.17, 0.67, 0.12, 1.0)`;
      const targetRad = startRotation + totalRotation;
      rotation = targetRad;
      canvas.style.transform = `rotate(${rotation}rad)`;

      // 等待动画结束
      const onEnd = () => {
        canvas.removeEventListener('transitionend', onEnd);
        canvas.style.transition = '';
        isSpinning = false;
        if (spinBtn) spinBtn.style.pointerEvents = 'auto';
        showResult();
      };
      canvas.addEventListener('transitionend', onEnd);

      // 安全备用：如果 transitionend 未触发，超时后强制结束
      setTimeout(() => {
        if (isSpinning) {
          canvas.removeEventListener('transitionend', onEnd);
          canvas.style.transition = '';
          isSpinning = false;
          if (spinBtn) spinBtn.style.pointerEvents = 'auto';
          showResult();
        }
      }, duration + 500);
    } else {
      // fallback: 无 canvas 时用 requestAnimationFrame
      function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        rotation = startRotation + totalRotation * easeOut;
        drawWheel();
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          isSpinning = false;
          if (spinBtn) spinBtn.style.pointerEvents = 'auto';
          showResult();
        }
      }
      requestAnimationFrame(animate);
    }
  }

  function showResult() {
    const normalizedRotation = rotation % (Math.PI * 2);
    // 指针在正上方 (-PI/2)
    const pointerAngle = (Math.PI * 1.5 - normalizedRotation + Math.PI * 2) % (Math.PI * 2);
    const sliceAngle = (Math.PI * 2) / wheelItems.length;
    const index = Math.floor(pointerAngle / sliceAngle);
    
    const result = wheelItems[index];
    
    const displayRes = document.getElementById('lw-display-result-new');
    if (displayRes) displayRes.textContent = result;
    
    document.getElementById('lw-result-text').textContent = result;
    document.getElementById('lw-result-wrap').classList.remove('hidden');
    
    if (typeof Effects !== 'undefined' && Effects.confetti) {
       Effects.confetti();
    }
  }

  return { init, openConfigModal, showWheel };
})();
